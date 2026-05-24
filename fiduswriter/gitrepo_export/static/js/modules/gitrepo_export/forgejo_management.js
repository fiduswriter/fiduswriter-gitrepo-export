import {Dialog, addAlert, escapeText, getCookie, getJson, post} from "../common"

export class ForgejoServerManagerDialog {
    constructor(onChange) {
        this.onChange = onChange
    }

    open() {
        return getJson("/api/gitrepo_export/manage_forgejo_servers/").then(
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
            title: gettext("Manage Forgejo Servers"),
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
                    <td>${escapeText(s.name || s.url)}</td>
                    <td>${escapeText(s.url)}</td>
                    <td>
                        <button type="button"
                            class="forgejo-delete-server ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small"
                            data-server-id="${s.id}">
                            ${gettext("Delete")}
                        </button>
                    </td>
                </tr>`
                  )
                  .join("")
            : `<tr><td colspan="3">${gettext("No Forgejo servers configured.")}</td></tr>`

        return `<table class="fw-dialog-table forgejo-server-list">
            <thead>
                <tr>
                    <th>${gettext("Name")}</th>
                    <th>${gettext("URL")}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <hr>
        <h4>${gettext("Add Forgejo Server")}</h4>
        <table class="fw-dialog-table">
            <tr>
                <th><label for="forgejo-instance-url">${gettext("Instance URL")}</label></th>
                <td><input type="text" id="forgejo-instance-url" class="fw-text" placeholder="https://code.example.org"></td>
            </tr>
            <tr>
                <th><label for="forgejo-name">${gettext("Name (label)")}</label></th>
                <td><input type="text" id="forgejo-name" class="fw-text" placeholder="${gettext("My Forgejo")}"></td>
            </tr>
            <tr>
                <th><label for="forgejo-token">${gettext("PAT Token")}</label></th>
                <td><input type="password" id="forgejo-token" class="fw-text"></td>
            </tr>
            <tr>
                <td colspan="2">
                    <p class="noteEl">
                        ${gettext("The token needs the following scopes: 'repo' (to read and write repository contents) and 'read:user' (to list your repositories).")}
                    </p>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                    <button type="button" id="forgejo-add-server"
                        class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark">
                        ${gettext("Verify & Save")}
                    </button>
                </td>
            </tr>
        </table>`
    }

    bind(dialog) {
        dialog.dialogEl
            .querySelector("#forgejo-add-server")
            .addEventListener("click", () => {
                this.addServer(dialog)
            })
        dialog.dialogEl
            .querySelectorAll(".forgejo-delete-server")
            .forEach(btn => {
                btn.addEventListener("click", () => {
                    this.deleteServer(dialog, btn.dataset.serverId)
                })
            })
    }

    addServer(dialog) {
        const instanceUrl = dialog.dialogEl
            .querySelector("#forgejo-instance-url")
            .value.trim()
        const name = dialog.dialogEl.querySelector("#forgejo-name").value.trim()
        const token = dialog.dialogEl
            .querySelector("#forgejo-token")
            .value.trim()
        if (!instanceUrl || !token) {
            addAlert(
                "error",
                gettext("Instance URL and PAT token are required.")
            )
            return
        }
        post("/api/gitrepo_export/manage_forgejo_servers/", {
            instance_url: instanceUrl,
            name,
            token
        })
            .then(() => {
                addAlert("info", gettext("Forgejo server added successfully."))
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
                                    "Could not verify Forgejo server. Check the URL and token."
                                )
                        )
                    })
                } else {
                    addAlert(
                        "error",
                        gettext(
                            "Could not verify Forgejo server. Check the URL and token."
                        )
                    )
                }
            })
    }

    deleteServer(dialog, serverId) {
        const csrfToken = getCookie("csrftoken")
        fetch("/api/gitrepo_export/manage_forgejo_servers/", {
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
                addAlert("info", gettext("Forgejo server deleted."))
                dialog.close()
                this.open()
            })
            .catch(() => {
                addAlert("error", gettext("Could not delete Forgejo server."))
            })
    }
}
