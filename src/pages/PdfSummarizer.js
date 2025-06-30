import React, { useState } from 'react';
import { pdfjs } from 'react-pdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import axios from 'axios';
import './PdfSummarizer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const PdfSummarizer = () => {
    const [pdfDocText, setPdfDocText] = useState('');
    const [pdfDocSummary, setPdfDocSummary] = useState('');
    const [loadingPDF, setLoadingPDF] = useState(false);
    const [excelSummary, setExcelSummary] = useState(null);

    // 📝 Handle file upload for PDF/DOCX and decide extraction method
    const onPdfDocFileChange = async (event) => {
        const file = event.target.files[0];
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'pdf') {
            await extractFromPDF(file);
        } else if (ext === 'docx') {
            await extractFromWord(file);
        } else {
            alert('Only PDF or DOCX supported.');
        }
    };

    // 📄 Extract raw text content from PDF using pdfjs
    const extractFromPDF = async (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const typedArray = new Uint8Array(e.target.result);
            const pdf = await pdfjs.getDocument(typedArray).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                text += pageText + '\n';
            }
            setPdfDocText(text);
        };
        reader.readAsArrayBuffer(file);
    };

    // 📝 Extract raw text content from DOCX using mammoth
    const extractFromWord = async (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
            setPdfDocText(result.value);
        };
        reader.readAsArrayBuffer(file);
    };

    // ✏️ Send extracted text to Hugging Face model to get summary
    const summarizePdfDoc = async () => {
        if (!pdfDocText) return alert('No content to summarize.');
        setLoadingPDF(true);
        setPdfDocSummary('');

        try {
            const response = await axios.post(
                'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
                { inputs: pdfDocText.slice(0, 2000) },
                {
                    headers: {
                        Authorization: `Bearer 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`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setPdfDocSummary(response.data[0]?.summary_text || 'No summary available.');
        } catch (err) {
            console.error(err);
            alert('Error summarizing. Check your token or try again.');
        } finally {
            setLoadingPDF(false);
        }
    };

    // 📥 Download generated PDF summary as a local PDF file
    const downloadPdfSummary = () => {
        const doc = new jsPDF();
        doc.text('Summary', 10, 10);
        const lines = doc.splitTextToSize(pdfDocSummary, 180);
        doc.text(lines, 10, 20);
        doc.save('summary.pdf');
    };

    // 📥 Download Excel analysis summary as a PDF report
    const downloadExcelSummary = () => {
        const doc = new jsPDF();
        let y = 10;

        Object.entries(excelSummary).forEach(([sheet, info]) => {
            doc.setFontSize(14);
            doc.text(`Sheet: ${sheet}`, 10, y);
            y += 8;

            doc.setFontSize(12);
            doc.text(`Overview: ${info.overview.numRows} rows, ${info.overview.numCols} columns`, 10, y);
            y += 8;

            if (Object.keys(info.numericStats).length > 0) {
                doc.text('Key Numeric Metrics:', 10, y);
                y += 7;
                Object.entries(info.numericStats).forEach(([col, stats]) => {
                    const text = `${col} — Max: ${stats.max}, Min: ${stats.min}, Avg: ${stats.avg}`;
                    doc.text(text, 14, y);
                    y += 6;
                });
            }

            if (Object.keys(info.columnTrends).length > 0) {
                y += 3;
                doc.text('Trends:', 10, y);
                y += 7;
                Object.entries(info.columnTrends).forEach(([col, trend]) => {
                    doc.text(`${col}: ${trend}`, 14, y);
                    y += 6;
                });
            }

            if (info.keyTakeaways.length > 0) {
                y += 3;
                doc.text('Key Takeaways:', 10, y);
                y += 7;
                info.keyTakeaways.forEach(takeaway => {
                    const lines = doc.splitTextToSize(`- ${takeaway}`, 180);
                    lines.forEach(line => {
                        doc.text(line, 14, y);
                        y += 6;
                    });
                });
            }

            y += 10;
            if (y > 260) {
                doc.addPage();
                y = 10;
            }
        });

        doc.save('excel_summary.pdf');
    };

    // 📂 Handle Excel file upload and trigger summary
    const onExcelFileChange = (event) => {
        const file = event.target.files[0];
        summarizeExcel(file);
    };

    // 📊 Generate summary and stats from Excel file using xlsx
    const summarizeExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const summary = {};

            workbook.SheetNames.forEach(sheet => {
                const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: '', raw: true });
                const numRows = data.length;
                const headers = data.length ? Object.keys(data[0]) : [];
                const numCols = headers.length;

                const numericStats = {};
                const columnTrends = {};

                headers.forEach(header => {
                    const colData = data.map(row => row[header]);
                    const numericValues = colData.filter(val => typeof val === 'number');
                    if (numericValues.length > 0) {
                        const max = Math.max(...numericValues);
                        const min = Math.min(...numericValues);
                        const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;

                        numericStats[header] = { max, min, avg: avg.toFixed(2) };

                        if (numericValues.length >= 3) {
                            const trend = numericValues[0] < numericValues[numericValues.length - 1] ? 'Increasing' : 'Decreasing';
                            columnTrends[header] = trend;
                        }
                    }
                });

                summary[sheet] = {
                    overview: { numRows, numCols },
                    numericStats,
                    columnTrends,
                    keyTakeaways: Object.entries(numericStats).slice(0, 3).map(
                        ([col, stats]) => `Column "${col}" has a high average value of ${stats.avg}`
                    )
                };
            });

            setExcelSummary(summary);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="split-container">
            {/* 📰 PDF/DOCX Summarizer UI */}
            <div className="left-panel">
                <h2>PDF / DOCX Summarizer</h2>
                <input type="file" accept=".pdf,.docx" onChange={onPdfDocFileChange} />
                <button className="button" onClick={summarizePdfDoc} disabled={!pdfDocText || loadingPDF}>
                    {loadingPDF ? 'Summarizing...' : 'Summarize'}
                </button>
                {pdfDocSummary && (
                    <>
                        <div className="summary-box">
                            <h4>Summary</h4>
                            <p>{pdfDocSummary}</p>
                        </div>
                        <button className="button" onClick={downloadPdfSummary}>Download Summary as PDF</button>
                    </>
                )}
            </div>

            {/* 📊 Excel Summary UI */}
            <div className="right-panel">
                <h2>Excel Summary</h2>
                <input type="file" accept=".xlsx" onChange={onExcelFileChange} />
                {excelSummary && (
                    <div className="excel-summary">
                        {Object.entries(excelSummary).map(([sheet, info]) => (
                            <div key={sheet} className="sheet-box">
                                <h4>📄 Sheet: {sheet}</h4>
                                <p><strong>Overview:</strong> {info.overview.numRows} rows, {info.overview.numCols} columns</p>
                                <strong>📊 Key Numeric Metrics:</strong>
                                <ul>
                                    {Object.entries(info.numericStats).map(([col, stats]) => (
                                        <li key={col}>
                                            <strong>{col}</strong> — Max: {stats.max}, Min: {stats.min}, Avg: {stats.avg}
                                        </li>
                                    ))}
                                </ul>
                                <strong>📈 Trends:</strong>
                                <ul>
                                    {Object.entries(info.columnTrends).map(([col, trend]) => (
                                        <li key={col}><strong>{col}:</strong> {trend}</li>
                                    ))}
                                </ul>
                                <strong>✅ Key Takeaways:</strong>
                                <ul>
                                    {info.keyTakeaways.map((point, index) => (
                                        <li key={index}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        <button className="button" onClick={downloadExcelSummary}>Download Excel Summary as PDF</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfSummarizer;
