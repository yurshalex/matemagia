import json
from pathlib import Path
from django.core.management.base import BaseCommand
from tools import generate_initial_data as generator


class Command(BaseCommand):
    help = 'Выгрузить 96 заданий из существующего генератора в фикстуру tests.'

    def handle(self, *args, **options):
        generator.TASKS.clear()
        generator.rng.seed(2026)
        data = [row for row in generator.build() if row['model'] == 'tests.task']
        if len(data) != 96:
            raise ValueError('Ожидалось 96 заданий')
        path = Path(__file__).resolve().parents[2] / 'fixtures' / 'initial_tasks.json'
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Выгружено {len(data)} заданий: {path}'))
