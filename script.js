// script.js - School Grants Viewer

let allData = [];
let filteredData = [];
let headers = [];

// CSV పార్స్ చేయడానికి హెల్పర్ ఫంక్షన్
function parseCSV(csvText) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (insideQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++;
            } else if (char === '"') {
                insideQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
            } else if (char === ',') {
                currentLine.push(currentField.trim());
                currentField = '';
            } else if (char === '\n') {
                currentLine.push(currentField.trim());
                currentField = '';
                if (currentLine.some(f => f.length > 0)) {
                    lines.push(currentLine);
                }
                currentLine = [];
            } else {
                currentField += char;
            }
        }
    }
    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        if (currentLine.some(f => f.length > 0)) {
            lines.push(currentLine);
        }
    }
    return lines;
}

// CSV డేటాను లోడ్ చేయండి (data.csv ఫైల్ నుండి)
async function loadData() {
    try {
        const response = await fetch('data.csv');
        if (!response.ok) throw new Error('CSV file not found');
        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length < 2) {
            console.warn('No data rows found in CSV');
            return;
        }

        headers = rows[0];
        allData = rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = row[i] || '';
            });
            return obj;
        });

        // Numeric columns conversion
        allData = allData.map(row => {
            // Convert Amount to number
            const amountCol = headers.find(h => h.includes('Amount') || h.includes('amount'));
            if (amountCol) {
                const val = parseFloat(String(row[amountCol]).replace(/,/g, ''));
                row[amountCol + '_num'] = isNaN(val) ? 0 : val;
            }
            return row;
        });

        filteredData = [...allData];
        renderFilters();
        renderTable();
        updateStats();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('tableBody').innerHTML =
            `<tr><td colspan="10" style="text-align:center;padding:40px;color:#e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size:24px;"></i><br><br>
                Could not load data.csv. Please make sure the file exists in the same folder.
                <br><small>${error.message}</small>
            </td></tr>`;
    }
}

// ఫిల్టర్ డ్రాప్డౌన్లను పాపులేట్ చేయండి
function populateFilter(selectId, column, placeholder = 'All') {
    const select = document.getElementById(selectId);
    if (!select) return;
    const values = new Set();
    allData.forEach(row => {
        const val = row[column];
        if (val && val.trim()) values.add(val.trim());
    });
    const sorted = Array.from(values).sort();
    select.innerHTML = `<option value="">All ${placeholder}</option>`;
    sorted.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    });
}

// ఫిల్టర్లను రెండర్ చేయండి
function renderFilters() {
    populateFilter('filterDistrict', 'Dist. Name', 'Districts');
    populateFilter('filterBlock', 'Block name', 'Blocks');

    // School Type from 'Schcat1' or 'Schcat'
    const schoolTypeCol = headers.find(h => h.includes('Schcat1') || h === 'Schcat');
    if (schoolTypeCol) {
        populateFilter('filterSchoolType', schoolTypeCol, 'Types');
    }

    // Enrolment Slab from 'Enr_slab'
    const enrCol = headers.find(h => h.includes('Enr_slab') || h === 'Enr_slab');
    if (enrCol) {
        populateFilter('filterEnrSlab', enrCol, 'Slabs');
    }
}

// ఫిల్టర్లను అప్లై చేయండి
function applyFilters() {
    const district = document.getElementById('filterDistrict').value;
    const block = document.getElementById('filterBlock').value;
    const schoolType = document.getElementById('filterSchoolType').value;
    const enrSlab = document.getElementById('filterEnrSlab').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    const schoolTypeCol = headers.find(h => h.includes('Schcat1') || h === 'Schcat');
    const enrCol = headers.find(h => h.includes('Enr_slab') || h === 'Enr_slab');

    filteredData = allData.filter(row => {
        // District filter
        if (district && row['Dist. Name'] !== district) return false;
        // Block filter
        if (block && row['Block name'] !== block) return false;
        // School Type filter
        if (schoolType && schoolTypeCol) {
            const val = row[schoolTypeCol] || '';
            if (val !== schoolType) return false;
        }
        // Enrolment Slab filter
        if (enrSlab && enrCol) {
            const val = row[enrCol] || '';
            if (val !== enrSlab) return false;
        }
        // Search filter
        if (search) {
            const searchable = Object.values(row).join(' ').toLowerCase();
            if (!searchable.includes(search)) return false;
        }
        return true;
    });

    renderTable();
    updateStats();
}

// టేబుల్ రెండర్ చేయండి
function renderTable() {
    const thead = document.getElementById('headerRow');
    const tbody = document.getElementById('tableBody');

    // Headers - show selected columns
    const displayCols = [
        'Sl.No.', 'Dist. Name', 'Block name', 'School Name',
        'Schcat', 'Schcat1', 'Schmgt_abstract', 'Catg',
        'Enr_slab', 'Enrol', 'Grant_a_mount in_lakhs', 'Amount'
    ];

    // Filter to only existing columns
    const cols = displayCols.filter(c => headers.includes(c));
    // Add "Amount" if not in displayCols
    if (!cols.includes('Amount') && headers.includes('Amount')) cols.push('Amount');

    // Render header
    thead.innerHTML = cols.map(h =>
        `<th>${h} <i class="fas fa-sort"></i></th>`
    ).join('');

    // Render body
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;padding:30px;color:#999;">
            <i class="fas fa-inbox" style="font-size:24px;"></i><br>No records found matching the filters.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filteredData.map(row => {
        return `<tr>${cols.map(col => {
            let val = row[col] || '';
            // Highlight grant amount
            if (col === 'Amount' || col === 'Grant_a_mount in_lakhs') {
                return `<td class="grant-amount">${val}</td>`;
            }
            return `<td>${val}</td>`;
        }).join('')}</tr>`;
    }).join('');

    document.getElementById('displayCount').textContent = filteredData.length;
}

// స్టాట్స్ అప్డేట్ చేయండి
function updateStats() {
    document.getElementById('totalSchools').textContent = allData.length;
    document.getElementById('filteredCount').textContent = filteredData.length;
    document.getElementById('recordCount').textContent = allData.length;

    // Total grant amount
    const amountCol = headers.find(h => h.includes('Amount') || h.includes('amount'));
    if (amountCol) {
        const total = filteredData.reduce((sum, row) => {
            const val = parseFloat(String(row[amountCol]).replace(/,/g, ''));
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        document.getElementById('totalGrant').textContent = '₹' + total.toLocaleString('en-IN');
    } else {
        document.getElementById('totalGrant').textContent = '₹0';
    }
}

// ఈవెంట్ లిజనర్స్
function initEventListeners() {
    document.getElementById('filterDistrict').addEventListener('change', applyFilters);
    document.getElementById('filterBlock').addEventListener('change', applyFilters);
    document.getElementById('filterSchoolType').addEventListener('change', applyFilters);
    document.getElementById('filterEnrSlab').addEventListener('change', applyFilters);

    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });

    document.getElementById('resetBtn').addEventListener('click', function() {
        document.getElementById('filterDistrict').value = '';
        document.getElementById('filterBlock').value = '';
        document.getElementById('filterSchoolType').value = '';
        document.getElementById('filterEnrSlab').value = '';
        document.getElementById('searchInput').value = '';
        applyFilters();
    });

    // Sort on header click
    document.getElementById('headerRow').addEventListener('click', function(e) {
        const th = e.target.closest('th');
        if (!th) return;
        const colIndex = Array.from(th.parentElement.children).indexOf(th);
        const cols = Array.from(th.parentElement.children).map(th => th.textContent.trim().replace(' ', ''));
        const colName = cols[colIndex];
        if (!colName) return;

        const isAsc = th.dataset.sort === 'asc';
        th.dataset.sort = isAsc ? 'desc' : 'asc';

        filteredData.sort((a, b) => {
            let va = a[colName] || '';
            let vb = b[colName] || '';

            // Try numeric sort
            const na = parseFloat(String(va).replace(/,/g, ''));
            const nb = parseFloat(String(vb).replace(/,/g, ''));
            if (!isNaN(na) && !isNaN(nb)) {
                return isAsc ? na - nb : nb - na;
            }
            return isAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

        // Update sort icons
        document.querySelectorAll('#headerRow th').forEach(h => h.dataset.sort = '');
        th.dataset.sort = isAsc ? 'desc' : 'asc';
        renderTable();
    });
}

// లోడ్ అయినప్పుడు రన్ అవ్వండి
document.addEventListener('DOMContentLoaded', function() {
    loadData().then(() => {
        initEventListeners();
        // Hide loading state if any
    });
});