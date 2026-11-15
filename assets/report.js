
/* ============================================
   WESTERN PROVINCE COMMUNITY REPORTING
   Custom form + Leaflet + Google Apps Script
============================================ */

/* Google Apps Script web app */
const REPORT_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwyad6xyYi4TWWBrj2xAv7K0doltkmQZZudttSKbDuMFWTpeqbyJePKOL2mA5dTrkj7hw/exec";

/* Map */
const reportMap = L.map("reportMap", {
    zoomControl: false
}).setView([6.93, 79.92], 10);

L.control.zoom({
    position: "bottomright"
}).addTo(reportMap);

L.control.scale({
    metric: true,
    imperial: false
}).addTo(reportMap);

/* Basemap */
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(reportMap);

/* Selected report location */
let selectedMarker = null;
let selectedLat = null;
let selectedLng = null;

/* HTML elements */
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");

const coordBadge = document.getElementById("coordBadge");
const selectedCoordinates =
    document.getElementById("selectedCoordinates");

const reportForm =
    document.getElementById("communityReportForm");

const submitButton =
    document.getElementById("submitReport");

const formStatus =
    document.getElementById("formStatus");

const submissionFrame =
    document.getElementById("submissionFrame");

let awaitingResponse = false;

/* Status message */
function showStatus(message, type = "") {
    formStatus.textContent = message;
    formStatus.className = "form-status " + type;
}

/* Select a location by clicking the map */
reportMap.on("click", function(event) {

    selectedLat = Number(event.latlng.lat.toFixed(6));
    selectedLng = Number(event.latlng.lng.toFixed(6));

    latitudeInput.value = selectedLat;
    longitudeInput.value = selectedLng;

    if (selectedMarker) {
        reportMap.removeLayer(selectedMarker);
    }

    /* Custom green and gold marker */
    const selectedIcon = L.divIcon({
        className: "",
        html: `
            <div style="
                width:22px;
                height:22px;
                background:#43875B;
                border:4px solid white;
                border-radius:50%;
                box-shadow:0 2px 9px rgba(0,0,0,.35);
            "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    selectedMarker = L.marker(
        [selectedLat, selectedLng],
        { icon: selectedIcon }
    ).addTo(reportMap);

    selectedMarker.bindPopup(`
        <strong>Selected observation location</strong><br>
        Latitude: ${selectedLat}<br>
        Longitude: ${selectedLng}
    `).openPopup();

    const coordinates =
        selectedLat + "° N, " + selectedLng + "° E";

    coordBadge.innerHTML =
        '<span class="location-dot"></span> Location selected';

    selectedCoordinates.textContent = coordinates;

    showStatus(
        "Location selected. Continue by choosing an observation category."
    );
});

/* Submit community observation */
reportForm.addEventListener("submit", function(event) {

    if (awaitingResponse) {
        event.preventDefault();
        return;
    }

    /* Location is compulsory */
    if (
        selectedLat === null ||
        selectedLng === null
    ) {
        event.preventDefault();

        showStatus(
            "Please select the observation location on the map first.",
            "error"
        );

        document.getElementById("reportMap")
            .scrollIntoView({ behavior: "smooth", block: "center" });

        return;
    }

    /* Check selected observation category */
    const selectedIssue =
        reportForm.querySelector(
            'input[name="issueType"]:checked'
        );

    if (!selectedIssue) {
        event.preventDefault();

        showStatus(
            "Please select the type of environmental observation.",
            "error"
        );

        return;
    }

    awaitingResponse = true;

    submitButton.disabled = true;
    submitButton.querySelector("span:first-child").textContent =
        "Sending observation...";

    showStatus(
        "Your observation is being sent to the community reporting database."
    );

    /*
      The browser submits the form to the hidden iframe.
      This avoids a normal cross-origin fetch request.
    */
});

/* Detect the response page loading in the hidden iframe */
submissionFrame.addEventListener("load", function() {

    if (!awaitingResponse) {
        return;
    }

    awaitingResponse = false;

    submitButton.disabled = false;
    submitButton.querySelector("span:first-child").textContent =
        "Submit community observation";

    /*
      The iframe load event confirms that a response page was returned.
      It does not independently prove that the spreadsheet write succeeded.
    */
    showStatus(
        "Submission request completed. Please check the response spreadsheet to confirm that your observation was recorded. The map may take up to two minutes to display it.",
        "success"
    );

    /* Do not erase the selected location or form values automatically. */
});

/* Initial guidance */
showStatus(
    "Start by selecting the location of the environmental change on the map."
);

/* Help Leaflet calculate the map size correctly */
setTimeout(function() {
    reportMap.invalidateSize();
}, 300);
