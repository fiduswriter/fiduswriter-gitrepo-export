NATIVE_FORMATS = [
    {"label": "Fidus", "key": "fidus", "ext": "fidus", "binary": True},
    {
        "label": "Fidusbook",
        "key": "fidusbook",
        "ext": "fidusbook",
        "binary": True,
    },
    {"label": "EPUB", "key": "epub", "ext": "epub", "binary": True},
    {
        "label": "Unpacked EPUB",
        "key": "unpacked_epub",
        "ext": "",
        "binary": False,
    },
    {"label": "HTML", "key": "html", "ext": "", "binary": False},
    {
        "label": "Unified HTML",
        "key": "unified_html",
        "ext": "html",
        "binary": False,
    },
    {"label": "LaTeX", "key": "latex", "ext": "", "binary": False},
    {"label": "ODT", "key": "odt", "ext": "odt", "binary": True},
    {"label": "DOCX", "key": "docx", "ext": "docx", "binary": True},
]


def get_all_formats():
    formats = NATIVE_FORMATS.copy()
    from django.apps import apps

    if apps.is_installed("pandoc"):
        from pandoc.export_formats import FORMATS as pandoc_formats

        formats += pandoc_formats
    return formats
