import QrScanner from 'https://cdn.jsdelivr.net/npm/qr-scanner@latest/qr-scanner.min.js';

window.addEventListener('DOMContentLoaded', init);

let parsedResults = [];

const video = document.getElementById("video");
const downloadCSVButton = document.getElementById("downloadCSVButton");
downloadCSVButton.addEventListener('click', downloadCSV);
const gatewayAddedNotification = document.getElementById("gatewayAddedNotification");

const qrScanner = new QrScanner(video, result => {
    if (!result.data) {
        console.warn("QR scanner returned empty result.");
        return;
    }
    handleScan(result.data);
},
{
    returnDetailedScanResult: true,
});
qrScanner.setInversionMode("both");
qrScanner.start();

function init() {
}

function handleScan(data) {
    // TRB
    // SN:xxxx;I:xxxx;M:xxxx;U:xxxx;PW:xxxx;B:xxxx;
    // RUT
    // WIFI:T:WPA;S:xxxx;P:xxxx;SN:xxxx;I:xxxxx;M:xxxx;U:xxxxx;PW:xxxx;B:xxxxx;
    const parsedResult = parseQRData(data);
    if (!parsedResult) {
        return;
    }
    if (parsedResults.find(element => element.serial == parsedResult.serial)) {
        return;
    }
    parsedResults.push(parsedResult);
    console.log(parsedResult);
    updateResultsTable(parsedResults);
    showNotification();
}

function parseQRData(data) {
    const parts = data.split(';').slice(0, -1);
    if (parts.length < 6) {
        console.warn("Scanned incompatible QR code.");
        return null;
    }
    const parsed = {};
    parsed["Type"] = "TRB";
    for (const part of parts) {
        if (part.startsWith("WIFI")) {
            const [wifi, key, value] = part.split(':');
            parsed[key] = value;
            parsed["Type"] = "RUT";
            continue;
        }
        const [key, value] = part.split(':');
        parsed[key] = value;
    }
    return {
        type: parsed.Type,
        serial: parsed.SN,
        imei: parsed.I,
        mac: parsed.M,
        user: parsed.U,
        password_confirmation: parsed.PW,
        batch: parsed.B,
        wifiType: parsed.T,
        wifiSsid: parsed.S,
        wifiPassword: parsed.P,
    };
}

function updateResultsTable(parsedResults) {
    const tableBody = document.querySelector("#resultsTable tbody");
    tableBody.innerHTML = '';

    for (const parsedResult of parsedResults.toReversed()) {
        const row = document.createElement('tr');

        const machineSerialCell = document.createElement('td');
        const machineSerialInput = document.createElement('input');
        machineSerialInput.setAttribute('data-gateway-serial', parsedResult.serial);
        if (parsedResult.machine) {
            machineSerialInput.value = parsedResult.machine;
        }
        machineSerialInput.addEventListener('input', updateMachineSerial);
        machineSerialCell.appendChild(machineSerialInput);
        row.appendChild(machineSerialCell);

        const gatewayTypeCell = document.createElement('td');
        gatewayTypeCell.textContent = parsedResult.type;
        row.appendChild(gatewayTypeCell);

        const gatewaySerialCell = document.createElement('td');
        gatewaySerialCell.textContent = parsedResult.serial;
        row.appendChild(gatewaySerialCell);

        tableBody.appendChild(row);
    }
}

function updateMachineSerial(event) {
    const gatewaySerial = event.target.getAttribute('data-gateway-serial');
    const resultIndex = parsedResults.findIndex(element => element.serial == gatewaySerial);
    parsedResults[resultIndex].machine = event.target.value;
}

function downloadCSV(event) {
    const headerRow = ["RMS Device Id", "Serial", "RMS Device Owner", "RMS Device Owner ID", "Created By", 
        "Created by ID", "Created Time", "Modified Time", "Last Activity Time", "Tag", "Unsubscribed Mode",
        "Unsubscribed Time", "Record Id", "Batch Number", "IMEI", "LAN MAC", "User Name", "Password Default",
        "Password New", "RMS Device Series", "Machine", "WIFI SSID", "WIFI Password New", "WIFI Password Default",
        "Status", "RMS Link", "Connected To", "Connected To Id"];

    const csvRows = [];
    for (const parsedResult of parsedResults) {
        const row = `,${parsedResult.serial},,,,,,,,,,,,${parsedResult.batch},${parsedResult.imei},${parsedResult.mac},` +
            `${parsedResult.user},${parsedResult.password_confirmation},,${parsedResult.type},${parsedResult.machine ?? ''},` +
            `${parsedResult.wifiSsid ?? ''},,${parsedResult.wifiPassword ?? ''},Live,,,,`;
        csvRows.push(row);
    }

    let csvData = headerRow.join(',') + '\n' + csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute('href', url);
    const currentDate = new Date();
    link.setAttribute('download', `gateway-import-${currentDate.getFullYear()}-${currentDate.getMonth()+1}-` +
        `${currentDate.getDate()}-${currentDate.getHours()}-${currentDate.getMinutes()}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function showNotification() {
    gatewayAddedNotification.hidden = false;
    setTimeout(() => {
        gatewayAddedNotification.hidden = true;
    }, 2000);
}
