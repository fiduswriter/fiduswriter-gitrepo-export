from django.db import migrations, models


def populate_targets(apps, schema_editor):
    BookRepository = apps.get_model("gitrepo_export", "BookRepository")
    for repo in BookRepository.objects.all():
        targets = []
        for fmt in [
            "epub",
            "unpacked_epub",
            "html",
            "unified_html",
            "latex",
            "odt",
            "docx",
        ]:
            if getattr(repo, f"export_{fmt}"):
                targets.append(fmt)
        repo.targets = targets
        repo.save()


def reverse_populate_targets(apps, schema_editor):
    BookRepository = apps.get_model("gitrepo_export", "BookRepository")
    for repo in BookRepository.objects.all():
        for fmt in [
            "epub",
            "unpacked_epub",
            "html",
            "unified_html",
            "latex",
            "odt",
            "docx",
        ]:
            setattr(repo, f"export_{fmt}", fmt in repo.targets)
        repo.save()


class Migration(migrations.Migration):
    dependencies = [
        (
            "gitrepo_export",
            "0002_bookrepository_export_docx_bookrepository_export_odt",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="bookrepository",
            name="targets",
            field=models.JSONField(default=list, blank=True),
        ),
        migrations.RunPython(populate_targets, reverse_populate_targets),
        migrations.RemoveField(
            model_name="bookrepository", name="export_epub"
        ),
        migrations.RemoveField(
            model_name="bookrepository", name="export_unpacked_epub"
        ),
        migrations.RemoveField(
            model_name="bookrepository", name="export_html"
        ),
        migrations.RemoveField(
            model_name="bookrepository", name="export_unified_html"
        ),
        migrations.RemoveField(
            model_name="bookrepository", name="export_latex"
        ),
        migrations.RemoveField(model_name="bookrepository", name="export_odt"),
        migrations.RemoveField(
            model_name="bookrepository", name="export_docx"
        ),
    ]
