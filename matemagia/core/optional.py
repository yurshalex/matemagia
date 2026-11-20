
import importlib


def optional_class(module_path: str, class_name: str):
    """Класс из модуля или None, если самого модуля (приложения) ещё нет."""
    try:
        module = importlib.import_module(module_path)
    except ModuleNotFoundError as exc:
        if exc.name in (module_path, module_path.split(".")[0]):
            return None
        raise
    return getattr(module, class_name, None)
