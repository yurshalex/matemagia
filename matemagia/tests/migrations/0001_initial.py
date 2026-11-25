from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):
    initial = True
    dependencies = [('learning', '0001_initial')]
    operations = [
        migrations.CreateModel(name='Task', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('task_type', models.CharField(max_length=30, choices=[('choice','Выбор ответа'),('input','Ввод числа'),('matching','Сопоставление'),('boolean','Верно / неверно'),('ordering','Упорядочивание')])),
            ('condition', models.TextField()),
            ('content_payload', models.JSONField(blank=True, null=True)),
            ('correct_answer', models.TextField()),
            ('explanation', models.TextField(blank=True, null=True)),
            ('difficulty_level', models.IntegerField(default=1, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(3)])),
            ('is_ai_generated', models.BooleanField(default=False)),
            ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='learning.topic')),
        ], options={'db_table':'tasks_task'}),
        migrations.AddConstraint(model_name='task', constraint=models.CheckConstraint(condition=models.Q(difficulty_level__gte=1, difficulty_level__lte=3), name='task_difficulty_1_3')),
    ]
