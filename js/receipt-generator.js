'use strict';

const STORAGE_KEY = 'receipt_generator_issuer_v1';
// 1ページ(A4)に印刷する領収書の枚数。常にこの枚数分のサイズで固定する
// （生成枚数がこれ未満でも1枚あたりのサイズは変わらない。CSS側の
// .receipt / .receipt-separator の高さと合わせて変更すること）。
const RECEIPTS_PER_PAGE = 3;

// ---------- 初期化 ----------
document.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    loadIssuerInfo();
    bindEvents();
});

function setDefaultDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('receiptDate').value = `${yyyy}-${mm}-${dd}`;
}

function bindEvents() {
    document.getElementById('saveIssuerBtn').addEventListener('click', saveIssuerInfo);
    document.getElementById('generateBtn').addEventListener('click', generateReceipts);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('nameList').addEventListener('input', updateNameCount);
}

// ---------- 発行者情報の保存・読み込み ----------
function saveIssuerInfo() {
    const data = {
        name: document.getElementById('issuerName').value,
        address: document.getElementById('issuerAddress').value,
        tel: document.getElementById('issuerTel').value,
        showStamp: document.getElementById('showStamp').checked,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const btn = document.getElementById('saveIssuerBtn');
    btn.classList.add('saved');
    btn.innerHTML = '<i class="fas fa-check"></i> 保存しました';
    setTimeout(() => {
        btn.classList.remove('saved');
        btn.innerHTML = '<i class="fas fa-floppy-disk"></i> 発行者情報を保存';
    }, 2000);
}

function loadIssuerInfo() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        document.getElementById('issuerName').value = data.name || '';
        document.getElementById('issuerAddress').value = data.address || '';
        document.getElementById('issuerTel').value = data.tel || '';
        document.getElementById('showStamp').checked = data.showStamp || false;
    } catch (e) {
        // 壊れたデータは無視
    }
}

// ---------- 宛名パース ----------
// Excelからのペースト（タブ区切り）に対応し、各行の最初の列だけを使う
function parseNames(text) {
    return text
        .split('\n')
        .map(line => line.split('\t')[0].trim())
        .filter(name => name.length > 0);
}

function updateNameCount() {
    const names = parseNames(document.getElementById('nameList').value);
    document.getElementById('nameCount').textContent = `${names.length} 名`;
}

// ---------- フォーマット ----------
function formatAmount(num) {
    return Number(num).toLocaleString('ja-JP');
}

function formatDateJP(dateStr) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${yyyy}年${parseInt(mm)}月${parseInt(dd)}日`;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------- 領収書HTML生成 ----------
function createReceiptHTML(name, data) {
    const stampHtml = data.showStamp
        ? `<div class="stamp-area"><div class="stamp-box">収入<br>印紙</div></div>`
        : '';

    const addressHtml = data.address
        ? `<div class="issuer-address">${escapeHtml(data.address)}</div>`
        : '';

    const telHtml = data.tel
        ? `<div class="issuer-tel">TEL: ${escapeHtml(data.tel)}</div>`
        : '';

    return `
        <h2 class="receipt-title">領　収　書</h2>
        <div class="recipient-line">
            <span class="recipient-name">${escapeHtml(name)}</span>
            <span class="recipient-sama">様</span>
        </div>
        <div class="amount-line">
            <span class="amount-label">金額</span>
            <div class="amount-box">
                <span class="amount-yen">¥</span>
                <span class="amount-value">${formatAmount(data.amount)}</span>
                <span class="amount-nari">也</span>
            </div>
        </div>
        <div class="purpose-line">
            <span class="purpose-label">但し</span>
            <span class="purpose-value">${escapeHtml(data.purpose)}</span>
        </div>
        <div class="receipt-footer">
            <div class="receipt-date-issuer">
                <div class="receipt-date">${formatDateJP(data.date)}</div>
                <div class="issuer-name">${escapeHtml(data.issuerName)}</div>
                ${addressHtml}
                ${telHtml}
            </div>
            ${stampHtml}
        </div>
    `;
}

// ---------- 領収書生成（メイン処理） ----------
function generateReceipts() {
    const issuerName = document.getElementById('issuerName').value.trim();
    const date = document.getElementById('receiptDate').value;
    const amount = document.getElementById('amount').value;
    const purpose = document.getElementById('purpose').value.trim();
    const namesText = document.getElementById('nameList').value;

    if (!issuerName) { Modal.alert('発行者名を入力してください。'); return; }
    if (!date) { Modal.alert('日付を入力してください。'); return; }
    if (!amount || Number(amount) <= 0) { Modal.alert('金額を入力してください。'); return; }
    if (!purpose) { Modal.alert('但し書きを入力してください。'); return; }

    const names = parseNames(namesText);
    if (names.length === 0) { Modal.alert('宛名を入力してください。'); return; }

    const data = {
        issuerName,
        address: document.getElementById('issuerAddress').value.trim(),
        tel: document.getElementById('issuerTel').value.trim(),
        date,
        amount,
        purpose,
        showStamp: document.getElementById('showStamp').checked,
    };

    const area = document.getElementById('receiptsArea');
    area.innerHTML = '';

    // A4 1枚 = 常に3枚組（RECEIPTS_PER_PAGE）で生成する。
    // 端数（1〜2枚)でも1枚あたりのサイズは変えない（CSS側で固定高にする前提）。
    for (let i = 0; i < names.length; i += RECEIPTS_PER_PAGE) {
        const group = document.createElement('div');
        group.className = 'receipt-group';

        const namesInGroup = names.slice(i, i + RECEIPTS_PER_PAGE);
        namesInGroup.forEach((name, indexInGroup) => {
            if (indexInGroup > 0) {
                const sep = document.createElement('div');
                sep.className = 'receipt-separator';
                sep.innerHTML = '<span>✂ ここで切り取ってください</span>';
                group.appendChild(sep);
            }

            const receipt = document.createElement('div');
            receipt.className = 'receipt';
            receipt.innerHTML = createReceiptHTML(name, data);
            group.appendChild(receipt);
        });

        area.appendChild(group);
    }

    document.getElementById('printBtn').disabled = false;
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
