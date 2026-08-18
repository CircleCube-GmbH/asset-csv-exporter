import QrScanner from 'https://cdn.jsdelivr.net/npm/qr-scanner@latest/qr-scanner.min.js';

window.addEventListener('DOMContentLoaded', init);

let parsedResults = [];
let qrScanner;

const video = document.getElementById("video");
const downloadCSVButton = document.getElementById("downloadCSVButton");
downloadCSVButton.addEventListener('click', downloadCSV);
const gatewayAddedNotification = document.getElementById("gatewayAddedNotification");

function init() {
    qrScanner = new QrScanner(video, result => {
        if (!result.data) {
            console.warn("QR scanner returned empty result.");
            return;
        }
        handleScan(result.data);
    },
    {
        returnDetailedScanResult: true,
        preferredCamera: 'environment'
    });
    qrScanner.setInversionMode("both");
    qrScanner.start().catch(err => {
        console.error("Camera activation failed:", err);
        showNotification("Failed to start camera. Please verify camera permissions.", 5000);
    });
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
    if (parsedResults.some(element => element.serial === parsedResult.serial)) {
        showNotification("Gateway already scanned!");
        return;
    }
    parsedResults.push(parsedResult);
    console.log(parsedResult);
    updateResultsTable(parsedResults);
    showNotification("Gateway added!");
}

function parseQRData(data) {
    const parts = data.split(';').map(p => p.trim()).filter(p => p.length > 0);
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
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) continue;
        const key = part.slice(0, colonIndex);
        const value = part.slice(colonIndex + 1);
        parsed[key] = value;
    }
    if (!parsed.SN) {
        console.warn("Scanned QR code does not contain a serial number (SN).");
        return null;
    }
    return {
        type: parsed.Type,
        serial: parsed.SN,
        imei: parsed.I || '',
        mac: parsed.M || '',
        user: parsed.U || '',
        password_confirmation: parsed.PW || '',
        batch: parsed.B || '',
        wifiType: parsed.T || '',
        wifiSsid: parsed.S || '',
        wifiPassword: parsed.P || '',
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

    const escapeCSV = (val) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvRows = [];
    for (const parsedResult of parsedResults) {
        const rowData = [
            "", // RMS Device Id
            parsedResult.serial, // Serial
            "", // RMS Device Owner
            "", // RMS Device Owner ID
            "", // Created By
            "", // Created by ID
            "", // Created Time
            "", // Modified Time
            "", // Last Activity Time
            "", // Tag
            "", // Unsubscribed Mode
            "", // Unsubscribed Time
            "", // Record Id
            parsedResult.batch, // Batch Number
            parsedResult.imei, // IMEI
            parsedResult.mac, // LAN MAC
            parsedResult.user, // User Name
            parsedResult.password_confirmation, // Password Default
            "", // Password New
            parsedResult.type, // RMS Device Series
            parsedResult.machine ?? '', // Machine
            parsedResult.wifiSsid ?? '', // WIFI SSID
            "", // WIFI Password New
            parsedResult.wifiPassword ?? '', // WIFI Password Default
            "Live", // Status
            "", // RMS Link
            "", // Connected To
            ""  // Connected To Id
        ];
        csvRows.push(rowData.map(escapeCSV).join(','));
    }

    let csvData = headerRow.join(',') + '\n' + csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute('href', url);
    
    const currentDate = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const year = currentDate.getFullYear();
    const month = pad(currentDate.getMonth() + 1);
    const day = pad(currentDate.getDate());
    const hours = pad(currentDate.getHours());
    const minutes = pad(currentDate.getMinutes());
    
    link.setAttribute('download', `gateway-import-${year}-${month}-${day}-${hours}-${minutes}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function showNotification(message, duration = 2000) {
    gatewayAddedNotification.textContent = message;
    gatewayAddedNotification.hidden = false;
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    window.notificationTimeout = setTimeout(() => {
        gatewayAddedNotification.hidden = true;
    }, duration);
}
