*************************
fiduswriter-github-export
*************************
A plugin to export books to github

**This plugin is currently in early-stage development. It has not reached production level quality yet.**

To install:

1. Make sure you have installed the `fiduswriter-books` plugin and you have updated both `fiduswriter` and `fiduswriter-books` to the latest 3.8.x patch release.

2. Install this plugin (for example by running ``pip install fiduswriter-github-export``).

3. Set up github as one of the connected login options. See instructions here: https://django-allauth.readthedocs.io/en/latest/providers.html#github

4. In your configuration.py file, add "github_export" to ``INSTALLED_APPS``.

5. In your configuration.py file, make sure to add repo rights for the github connector like this::

    SOCIALACCOUNT_PROVIDERS = {
        'github': {
            'SCOPE': [
                'repo',
            ],
        }
    }
