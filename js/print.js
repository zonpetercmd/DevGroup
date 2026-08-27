// js/print.js - Print Engine

import { showToast, numberToWords, formatDate, formatCurrency } from './utils.js';

class PrintEngine {
    constructor() {
        this.template = null;
    }

    async loadTemplate() {
        if (this.template) return this.template;
        try {
            const response = await fetch('templates/print-template.html');
            this.template = await response.text();
            return this.template;
        } catch {
            this.template = this._getFallback();
            return this.template;
        }
    }

    async print(voucher, allFirms) {
        const template = await this.loadTemplate();
        const firm = allFirms[voucher.firmKey] || allFirms['DevVidyalaya'];
        
        const data = {
            vno: voucher.vno || '',
            date: formatDate(voucher.date) || '',
            head: voucher.head || '',
            subHead: voucher.subHead || '-',
            party: voucher.party || '',
            narration: voucher.narration || '-',
            mode: voucher.mode || '',
            bankName: voucher.bankName || '',
            bankAccount: voucher.bankAccount || '',
            referenceNo: voucher.referenceNo || '',
            signatory: voucher.signatory || '',
            amount: formatCurrency(voucher.amount || 0),
            amountWords: numberToWords(voucher.amount || 0) + ' Rupees Only',
            createdBy: voucher.createdBy || '',
            companyName: firm?.name || voucher.firmName || '',
            address: firm?.addr || '',
            phone: firm?.mobile || '',
            email: firm?.email || '',
            logo: firm?.logo || 'logo.png',
            currentTime: new Date().toLocaleString(),
            title: voucher.mode === 'Cash' ? 'CASH PAYMENT VOUCHER' : 'BANK PAYMENT VOUCHER'
        };

        let html = template;
        for (const [key, value] of Object.entries(data)) {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            showToast('Please allow popups');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        return printWindow;
    }

    _getFallback() {
        return `<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>{{vno}}</title>
        <style>
            body { font-family: 'Courier New', monospace; padding: 20mm; }
            .voucher { border: 2px solid #000; padding: 15mm; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .title { text-align: center; font-size: 16px; font-weight: bold; margin: 10px 0; }
            .details { line-height: 1.8; }
            .amount { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; }
        </style>
        </head>
        <body>
        <div class="voucher">
            <div class="header">
                <h1>{{companyName}}</h1>
                <p>{{address}} | 📞 {{phone}}</p>
            </div>
            <div class="title">{{title}}</div>
            <div class="details">
                <p><strong>Voucher No:</strong> {{vno}} | <strong>Date:</strong> {{date}}</p>
                <p><strong>Head:</strong> {{head}} | <strong>Sub Head:</strong> {{subHead}}</p>
                <p><strong>Party:</strong> <span style="font-size:18px;">{{party}}</span></p>
                <p><strong>Narration:</strong> {{narration}}</p>
                <p><strong>Mode:</strong> {{mode}} | <strong>Bank:</strong> {{bankName}} {{bankAccount}}</p>
                <p><strong>Ref No:</strong> {{referenceNo}} | <strong>Signatory:</strong> {{signatory}}</p>
            </div>
            <div class="amount">
                <p>TOTAL: {{amount}}</p>
                <p>{{amountWords}}</p>
            </div>
            <div class="signatures">
                <div>Prepared By: {{createdBy}}</div>
                <div>Authorised: {{signatory}}</div>
                <div>Receiver's Signature: ___________</div>
            </div>
        </div>
        </body></html>`;
    }
}

export default PrintEngine;
