import json
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from core.results import ResultCode
from learning.models import Topic
from .forms import SeriesForm
from .models import Task
from .services import TaskService

service = TaskService()
SESSION_KEY = 'task_series'
SERIES_LENGTH = 10


def _json_requested(request):
    return ('application/json' in request.headers.get('Accept', '') or request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.content_type == 'application/json')


def _error(code, errors, status=400):
    return JsonResponse({'code': code, 'errors': errors}, status=status)


def _trainer(request, context):
    from django.template.loader import get_template
    from django.template import TemplateDoesNotExist
    try:
        get_template('tests/task_trainer.html')
    except TemplateDoesNotExist:
        return JsonResponse(context)
    return render(request, 'tests/task_trainer.html', context)


def _new_series(form):
    topic = form.cleaned_data['topic']
    return {'topic': topic.pk if topic else None, 'type': form.cleaned_data['type'] or None,
            'difficulty': form.cleaned_data['difficulty'], 'number': 0, 'issued_ids': [], 'answered_ids': []}


@login_required
@require_GET
def task_list_view(request):
    form = SeriesForm(request.GET)
    if not form.is_valid():
        return _error(ResultCode.VALIDATION_ERROR, form.errors.get_json_data())
    series = _new_series(form)
    request.session[SESSION_KEY] = series
    context = {'topics': list(Topic.objects.values('id', 'title')), 'task_types': list(Task.Type.choices), 'series': series}
    if _json_requested(request):
        return JsonResponse(context)
    return _trainer(request, context)


@login_required
@require_GET
def task_next_view(request):
    series = request.session.get(SESSION_KEY)
    if series is None or any(k in request.GET for k in ('topic', 'type', 'difficulty')):
        params = {k: v for k,v in (('topic', (series or {}).get('topic')), ('type', (series or {}).get('type')), ('difficulty', (series or {}).get('difficulty'))) if v is not None}
        params.update(request.GET.dict())
        form = SeriesForm(params)
        if not form.is_valid():
            return _error(ResultCode.VALIDATION_ERROR, form.errors.get_json_data())
        new = _new_series(form)
        if series is None or any(new[k] != series[k] for k in ('topic','type','difficulty')) or request.GET.get('restart') == '1':
            series = new
    if request.GET.get('restart') == '1':
        series = {**series, 'number': 0, 'issued_ids': [], 'answered_ids': []}
    if series['number'] >= SERIES_LENGTH:
        return JsonResponse({'finished': True, 'number': series['number'], 'total': SERIES_LENGTH})
    result = service.get_next_task(request.user, series['topic'], series['type'], series['difficulty'], series['issued_ids'])
    if not result.ok:
        request.session[SESSION_KEY] = series
        return JsonResponse({'code': result.code, 'errors': result.errors,
                             'finished': True, 'number': series['number'],
                             'total': SERIES_LENGTH}, status=404)
    task = result.data
    series['issued_ids'].append(task['id'])
    series['number'] += 1
    request.session[SESSION_KEY] = series
    return JsonResponse({**task, 'number': series['number'], 'total': SERIES_LENGTH, 'finished': False})


@login_required
@require_GET
def task_detail_view(request, task_id):
    result = service.get_task(task_id)
    if not result.ok:
        if _json_requested(request):
            return _error(result.code, result.errors, 404)
        raise Http404('Задание не найдено')
    task = result.data
    if _json_requested(request):
        return JsonResponse(task)
    return _trainer(request, {'task': task, 'series': request.session.get(SESSION_KEY)})


@login_required
@require_POST
def check_answer_view(request, task_id):
    if request.content_type == 'application/json':
        try:
            body = json.loads(request.body)
            if not isinstance(body, dict) or 'answer' not in body:
                raise ValueError
            answer = body['answer']
        except (ValueError, UnicodeError):
            return _error(ResultCode.INVALID_ANSWER_FORMAT, {'answer': 'Ожидается JSON с полем answer'})
    else:
        answer = request.POST.get('answer')
    series = request.session.get(SESSION_KEY)
    # RewardService сам определяет первую попытку и работу над ошибками.
    result = service.check_answer(request.user, task_id, answer, record_xp=True)
    if not result.ok:
        return _error(result.code, result.errors, 404 if result.code == ResultCode.NOT_FOUND else 400)
    if series and task_id in series['issued_ids'] and task_id not in series['answered_ids']:
        series['answered_ids'].append(task_id)
        request.session[SESSION_KEY] = series
    if _json_requested(request):
        return JsonResponse(result.data)
    from django.template.loader import select_template
    from django.template import TemplateDoesNotExist
    try:
        template = select_template(['tests/result.html'])
    except TemplateDoesNotExist:
        return JsonResponse(result.data)
    return render(request, template.template.name, result.data)
