from django import forms
from learning.models import Topic
from .models import Task


class SeriesForm(forms.Form):
    topic = forms.ModelChoiceField(queryset=Topic.objects.all(), required=False)
    type = forms.ChoiceField(choices=[('', 'Все форматы'), *Task.Type.choices], required=False)
    difficulty = forms.IntegerField(min_value=1, max_value=3, required=False)
