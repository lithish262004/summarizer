import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import './PdfSummarizer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const PdfSummarizer = () => {
    const [file, setFile] = useState(null);
    const [text, setText] = useState('');
    const [summary, setSummary] = useState('');
    const [fileType, setFileType] = useState('');

    const onFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        setFile(selectedFile);
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();
        setFileType(fileExt);

        if (fileExt === 'pdf') {
            await extractTextFromPDF(selectedFile);
        } else if (fileExt === 'docx') {
            await extractTextFromWord(selectedFile);
        } else if (fileExt === 'xlsx') {
            await extractTextFromExcel(selectedFile);
        } else {
            alert('Unsupported file type. Please upload PDF, DOCX, or XLSX.');
        }
    };

    const extractTextFromPDF = async (selectedFile) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const typedArray = new Uint8Array(e.target.result);
            const pdf = await pdfjs.getDocument(typedArray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            setText(fullText);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const extractTextFromWord = async (selectedFile) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
            setText(result.value);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const extractTextFromExcel = async (selectedFile) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            let result = '';
            workbook.SheetNames.forEach(sheet => {
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 });
                sheetData.forEach(row => {
                    result += row.join(' ') + '\n';
                });
            });
            setText(result);
        };
        reader.readAsBinaryString(selectedFile);
    };

    const summarizeText = () => {
        const sentences = text.split(/[.!?]/).filter(Boolean);
        const summaryText = sentences.slice(0, 3).join('. ') + '.';
        setSummary(summaryText);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('Summary', 10, 10);
        const lines = doc.splitTextToSize(summary, 180);
        doc.text(lines, 10, 20);
        doc.save('summary.pdf');
    };

    return (
        <div className="container">
            <h1>File Summarizer (PDF / Word / Excel)</h1>
            <input type="file" accept=".pdf,.docx,.xlsx" onChange={onFileChange} />
            <button className="button" onClick={summarizeText} disabled={!text}>Summarize</button>
            {summary && (
                <>
                    <div className="summary">
                        <h3>Summary</h3>
                        <p>{summary}</p>
                    </div>
                    <button className="button" onClick={exportToPDF}>Download Summary as PDF</button>
                </>
            )}
            <div className="footer">
                <p className="footer-text">Developed by
                    <a href="https://minduladilthushan.netlify.app/"
                        target="_blank" rel="noopener noreferrer"
                        style={{
                            textDecoration: 'none',
                            fontWeight: "bold"
                        }}>&nbsp;LITHISH.M</a>&nbsp;&nbsp;^_~
                </p>
            </div>
        </div>
    );
};

export default PdfSummarizer;
