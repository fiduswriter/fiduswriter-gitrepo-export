from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ("gitrepo_export", "0003_targets"),
    ]

    operations = [
        migrations.CreateModel(
            name="DocumentRepository",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "document",
                    models.ForeignKey(
                        "document.Document",
                        on_delete=django.db.models.deletion.CASCADE,
                    ),
                ),
                ("repo_id", models.IntegerField()),
                ("repo_name", models.CharField(max_length=256)),
                (
                    "repo_type",
                    models.CharField(
                        max_length=8,
                        choices=[
                            ("github", "GitHub"),
                            ("gitlab", "GitLab"),
                            ("forgejo", "Forgejo"),
                        ],
                    ),
                ),
                ("targets", models.JSONField(default=list, blank=True)),
            ],
            options={"verbose_name_plural": "Document repositories"},
        ),
        migrations.CreateModel(
            name="ForgejoServer",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        settings.AUTH_USER_MODEL,
                        on_delete=django.db.models.deletion.CASCADE,
                    ),
                ),
                (
                    "instance_url",
                    models.URLField(
                        help_text="Base URL of the Forgejo instance (e.g. https://code.example.org)"
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        blank=True,
                        help_text="A label to identify this instance",
                        max_length=128,
                    ),
                ),
                (
                    "token",
                    models.CharField(
                        help_text="Personal Access Token with repo scope",
                        max_length=256,
                    ),
                ),
                ("active", models.BooleanField(default=True)),
                ("added", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name_plural": "Forgejo servers"},
        ),
        migrations.AlterField(
            model_name="bookrepository",
            name="repo_type",
            field=models.CharField(
                max_length=8,
                choices=[
                    ("github", "GitHub"),
                    ("gitlab", "GitLab"),
                    ("forgejo", "Forgejo"),
                ],
            ),
        ),
    ]
