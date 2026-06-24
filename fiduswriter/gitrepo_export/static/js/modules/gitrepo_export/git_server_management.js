import {Dialog, addAlert, escapeText, getCookie, getJson, post} from "fwtoolkit"

const SERVER_TYPE_LABELS = {
    forgejo: "Forgejo",
    gitea: "Gitea",
    github: "GitHub",
    gitlab: "GitLab"
}

const SCOPE_NOTES = {
    github: gettext(
        "Use a Classic Personal Access Token (Settings → Developer settings → Personal access tokens → Tokens (classic)). Fine-grained tokens are not supported. The token needs the 'repo' scope."
    ),
    gitlab: gettext(
        "Use a Personal Access Token from your User Settings → Access Tokens. Project or Group tokens will not work. The token needs the 'api' scope."
    ),
    forgejo: gettext(
        "The token needs the following scopes: 'repo' (to read and write repository contents) and 'read:user' (to list your repositories)."
    ),
    gitea: gettext(
        "The token needs the following scopes: 'repo' (to read and write repository contents) and 'read:user' (to list your repositories)."
    )
}

export class GitServerManagerDialog {
    constructor(onChange) {
        this.onChange = onChange
    }

    open() {
        return getJson("/api/gitrepo_export/manage_git_servers/").then(
            ({servers}) => {
                this.showDialog(servers)
            }
        )
    }

    showDialog(servers) {
        const content = this.renderServerList(servers)
        const buttons = [
            {
                text: gettext("Close"),
                classes: "fw-dark",
                click: () => {
                    dialog.close()
                    if (this.onChange) {
                        this.onChange()
                    }
                }
            }
        ]
        const dialog = new Dialog({
            title: gettext("Manage Git Servers"),
            width: 500,
            body: content,
            buttons
        })
        dialog.open()
        this.bind(dialog)
    }

    renderServerList(servers) {
        const rows = servers.length
            ? servers
                  .map(
                      s => `
                <tr>
                    <td>${escapeText(SERVER_TYPE_LABELS[s.type] || s.type)}</td>
                    <td>${escapeText(s.name || s.url || "—")}</td>
                    <td>${escapeText(s.url || "—")}</td>
                    <td>
                        <button type="button"
                            class="git-delete-server ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small"
                            data-server-id="${s.id}">
                            ${gettext("Delete")}
                        </button>
                    </td>
                </tr>`
                  )
                  .join("")
            : `<tr><td colspan="4">${gettext("No git servers configured.")}</td></tr>`

        return `<table class="fw-dialog-table git-server-list">
            <thead>
                <tr>
                    <th>${gettext("Type")}</th>
                    <th>${gettext("Name")}</th>
                    <th>${gettext("URL")}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <hr>
        <h4>${gettext("Add Git Server")}</h4>
        <table class="fw-dialog-table">
            <tr>
                <th><label for="git-server-type">${gettext("Server Type")}</label></th>
                <td>
                    <select id="git-server-type" class="entry-form fw-button fw-light">
                        <option value="forgejo">Forgejo</option>
                        <option value="gitea">Gitea</option>
                        <option value="github">GitHub</option>
                        <option value="gitlab">GitLab</option>
                    </select>
                </td>
            </tr>
            <tr id="git-instance-url-row">
                <th><label for="git-instance-url">${gettext("Instance URL")}</label></th>
                <td><input type="text" id="git-instance-url" class="fw-text" placeholder="https://code.example.org"></td>
            </tr>
            <tr>
                <th><label for="git-name">${gettext("Name (label)")}</label></th>
                <td><input type="text" id="git-name" class="fw-text" placeholder="${gettext("My Server")}"></td>
            </tr>
            <tr>
                <th><label for="git-token">${gettext("PAT Token")}</label></th>
                <td><input type="password" id="git-token" class="fw-text"></td>
            </tr>
            <tr>
                <td colspan="2">
                    <p class="noteEl" id="git-scope-note">
                        ${SCOPE_NOTES.forgejo}
                    </p>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                    <button type="button" id="git-add-server"
                        class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark">
                        ${gettext("Verify & Save")}
                    </button>
                </td>
            </tr>
        </table>`
    }

    bind(dialog) {
        const typeSelect = dialog.dialogEl.querySelector("#git-server-type")
        typeSelect.addEventListener("change", () => {
            const type = typeSelect.value
            const urlRow = dialog.dialogEl.querySelector(
                "#git-instance-url-row"
            )
            const scopeNote = dialog.dialogEl.querySelector("#git-scope-note")
            if (type === "github") {
                urlRow.style.display = "none"
            } else {
                urlRow.style.display = ""
            }
            scopeNote.textContent = SCOPE_NOTES[type] || ""
        })
        // Initialize visibility
        if (typeSelect.value === "github") {
            dialog.dialogEl.querySelector(
                "#git-instance-url-row"
            ).style.display = "none"
        }

        dialog.dialogEl
            .querySelector("#git-add-server")
            .addEventListener("click", () => {
                this.addServer(dialog)
            })
        dialog.dialogEl.querySelectorAll(".git-delete-server").forEach(btn => {
            btn.addEventListener("click", () => {
                this.deleteServer(dialog, btn.dataset.serverId)
            })
        })
    }

    addServer(dialog) {
        const serverType =
            dialog.dialogEl.querySelector("#git-server-type").value
        const instanceUrl = dialog.dialogEl
            .querySelector("#git-instance-url")
            .value.trim()
        const name = dialog.dialogEl.querySelector("#git-name").value.trim()
        const token = dialog.dialogEl.querySelector("#git-token").value.trim()
        if (serverType !== "github" && !instanceUrl) {
            addAlert(
                "error",
                gettext("Instance URL is required for this server type.")
            )
            return
        }
        if (!token) {
            addAlert("error", gettext("PAT token is required."))
            return
        }
        post("/api/gitrepo_export/manage_git_servers/", {
            server_type: serverType,
            instance_url: instanceUrl,
            name,
            token
        })
            .then(() => {
                addAlert("info", gettext("Git server added successfully."))
                dialog.close()
                this.open()
            })
            .catch(response => {
                if (response && response.text) {
                    response.text().then(text => {
                        addAlert(
                            "error",
                            text ||
                                gettext(
                                    "Could not verify server. Check the URL and token."
                                )
                        )
                    })
                } else {
                    addAlert(
                        "error",
                        gettext(
                            "Could not verify server. Check the URL and token."
                        )
                    )
                }
            })
    }

    deleteServer(dialog, serverId) {
        const csrfToken = getCookie("csrftoken")
        fetch("/api/gitrepo_export/manage_git_servers/", {
            method: "DELETE",
            headers: {
                "X-CSRFToken": csrfToken,
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            },
            credentials: "include",
            body: JSON.stringify({server_id: parseInt(serverId)})
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error()
                }
                addAlert("info", gettext("Git server deleted."))
                dialog.close()
                this.open()
            })
            .catch(() => {
                addAlert("error", gettext("Could not delete git server."))
            })
    }
}
