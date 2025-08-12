
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- CONFIGURATION (Quote Builder) ---
const BASE_SINK_PRICE = 1450;
const BASE_IRREGULAR_SINK_PRICE = 2450;
const BASE_DIMENSIONS = { length: 30, width: 19.5, height: 8 };
const PRICE_PER_INCH = { lw: 50, h_tier1: 100, h_tier2: 150 };
const HEIGHT_TIER1_THRESHOLD = 12;
const BACKSPLASH_CONFIG = {
    materials: {
        luxe: { basePrice: 100 },
        textured: { basePrice: 350 },
        luxe_hammered: { basePrice: 100, upcharge: 0.25 }
    },
    pricePerInch: 10,
    edgeProfilePricePerSqFt: 10,
    maxLength: 120,
    maxWidth: 48
};
const PERCENTAGES = {
    material: { copper: 0.2586, brass: 0.5172 },
    finish: { stainless: { prestige: 0.1293, hammered: 0.2586 }, copper: { prestige: 0.1027, hammered: 0.2055 }, brass: { prestige: 0.1293, hammered: 0.2586 } },
    addOns: { faucetDeck: 0.1293, edgeProfile: 0.1034, radiusCorner: 0.2586, faucetHole: 0.0259, drainHole: 0.227 },
    irregularAddOns: {
        faucetDeck: 0.1293 * 2,
        edgeProfile: 0.1034 * 3
    },
    complexity: { level_1: 0, level_2: 0.20, level_3: 0.45 },
    shipping: { standard: 0.045, custom: 0.075, canada: 0.09, local: 0 },
    tax: { state: 0.06, county: 0.005 }
};
const FINISH_OPTIONS = {
    stainless: [{ value: 'none', text: 'Luxe (No upcharge)' }, { value: 'prestige', text: 'Prestige / Royal Oak / etc.' }, { value: 'hammered', text: 'Luxe-Hammered' }],
    copper: [{ value: 'none', text: 'Raw Copper (No upcharge)' }, { value: 'prestige', text: 'Natural / Micro-Hammered Raw' }, { value: 'hammered', text: 'Hand-Hammered / Patina' }],
    brass: [{ value: 'none', text: 'Luxe Brass (No upcharge)' }, { value: 'prestige', text: 'Natural Brass' }, { value: 'hammered', text: 'Hammered Brass' }]
};
const COMPLEXITY_OPTIONS = [
    { value: 'level_1', text: 'Level 1 (Standard Corner)' },
    { value: 'level_2', text: 'Level 2 (Linear Walls w/ Offset)' },
    { value: 'level_3', text: 'Level 3 (Non-Linear Walls)' }
];
const ADDON_DESCRIPTIONS = {
    bowlConfig: { '0.3879': 'Double Bowl', '0.7758': 'Triple Bowl' },
    aprons: { '0.3879': '1 Apron', '0.6465': '2 Aprons' },
    ledges: { '0.1293': '1 Ledge', '0.2586': '2 Ledges' },
    drainboards: { '0.3879': '1 Drainboard', '0.7758': '2 Drainboards' },
};
const EDIT_PASSCODE = 'havens2024';

export default function SalesToolkit() {
    // --- APP STATE ---
    const [currentView, setCurrentView] = useState('dashboard');
    const [currentItemType, setCurrentItemType] = useState('sink');
    
    // --- QUOTE BUILDER STATE ---
    const [quoteState, setQuoteState] = useState({
        sinkLength: BASE_DIMENSIONS.length, sinkWidth: BASE_DIMENSIONS.width, sinkHeight: BASE_DIMENSIONS.height, material: 'stainless', finish: 'none',
        isinkLength: BASE_DIMENSIONS.length, isinkWidth: BASE_DIMENSIONS.width, isinkHeight: BASE_DIMENSIONS.height, imaterial: 'stainless', ifinish: 'none', complexity: 'level_1',
        backsplashLength: 0, backsplashWidth: 0, backsplashMaterial: 'luxe', backsplashEdgeProfile: 0,
        bowlConfig: '0', aprons: '0', ledges: '0', drainboards: '0',
        faucetDeck: false, edgeProfile: false, radiusCorner: false, faucetHole: false, drainHole: false,
    });
    const [pdfInfo, setPdfInfo] = useState({ quoteNumber: '', customerName: '', billTo: '', customerPhone: '', customerEmail: '', amountPaid: '', notes: '' });
    const [masterQuoteItems, setMasterQuoteItems] = useState([]);
    const [masterQuoteTotals, setMasterQuoteTotals] = useState({ subtotal: 0, shippingCost: 0, totalTax: 0, grandTotal: 0 });
    const [masterQuoteSettings, setMasterQuoteSettings] = useState({ shipping: 'standard', tax: false });

    const [currentItemBreakdown, setCurrentItemBreakdown] = useState({ html: '', total: 0, mainDescription: '', subItems: [] });
    const [dynamicLabels, setDynamicLabels] = useState({});
    
    // --- MODAL & UI STATE ---
    const [modals, setModals] = useState({ guide: false, cornerCalc: false, aiResults: false, aiExport: false, saveTemplate: false, templateVars: false, deleteConfirm: false, passcode: false });
    const [cornerCalcState, setCornerCalcState] = useState({ wallA: '', wallB: '', hypotenuseC: '', armWidth: '' });
    const [hypotenuseLastEdited, setHypotenuseLastEdited] = useState(null);
    const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);

    // --- AI STATE ---
    const [crmData, setCrmData] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [parsedLeads, setParsedLeads] = useState(null);
    const [aiGeneratedQuotes, setAiGeneratedQuotes] = useState([]);
    const [aiExportSettings, setAiExportSettings] = useState({ shipping: 'standard', tax: false });
    const [zipping, setZipping] = useState(false);
    
    // --- EMAIL HELPER STATE ---
    const [emailTemplates, setEmailTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [currentAttachment, setCurrentAttachment] = useState(null);
    const attachmentInputRef = useRef(null);
    const [templateVars, setTemplateVars] = useState({ customerName: '', quoteNumber: '', balanceDue: '', customerAddress: '' });
    const [showEmailCopyConf, setShowEmailCopyConf] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [passcodeError, setPasscodeError] = useState(false);
    const [modalTemplateName, setModalTemplateName] = useState('');
    
    // --- REFS ---
    const emailEditorRef = useRef(null);

    // --- UTILITY FUNCTIONS ---
    const formatAsCurrency = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const showToast = (setter) => {
        setter(true);
        setTimeout(() => setter(false), 3000);
    };
    const dataURLtoBlob = (dataurl) => {
        if (!dataurl) return null;
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };
    const createSummaryLine = (label, value, isSubtotal = false) => {
        const valueClass = isSubtotal ? 'font-semibold text-gray-800' : 'text-gray-600';
        return `<div class="summary-line"><span>${label}</span><span class="${valueClass}">${formatAsCurrency(value)}</span></div>`;
    };
    const toggleModal = (modalName, state) => setModals(prev => ({ ...prev, [modalName]: state }));


    // --- Handlers: Input Changes ---
    const handleQuoteChange = (e) => {
        const { name, value, type, checked } = e.target;
        setQuoteState(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    const handlePdfInfoChange = (e) => {
        const { name, value } = e.target;
        setPdfInfo(prev => ({ ...prev, [name]: value }));
    };
    const handleMasterQuoteSettingsChange = (e) => {
        const { name, value, type, checked } = e.target;
        setMasterQuoteSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // --- Calculations ---
    const calculateSinkPrice = useCallback((isIrregular = false, leadData = null) => {
        let breakdownHTML = '';
        let sinkTotal = 0;
        let subItems = [];

        const getSourceData = () => {
            if (leadData) {
                return {
                    length: leadData.dimensions.length, width: leadData.dimensions.width, height: leadData.dimensions.height,
                    material: leadData.material, finish: leadData.finish, complexity: leadData.complexity,
                    bowlConfig: leadData.addOns.bowlConfig || "0", aprons: leadData.addOns.aprons || "0", ledges: leadData.addOns.ledges || "0", drainboards: leadData.addOns.drainboards || "0",
                    faucetDeck: leadData.addOns.faucetDeck || false, edgeProfile: leadData.addOns.edgeProfile || false, radiusCorner: leadData.addOns.radiusCorner || false, faucetHole: leadData.addOns.faucetHole || false, drainHole: leadData.addOns.drainHole || false,
                };
            }
            return {
                length: parseFloat(isIrregular ? quoteState.isinkLength : quoteState.sinkLength),
                width: parseFloat(isIrregular ? quoteState.isinkWidth : quoteState.sinkWidth),
                height: parseFloat(isIrregular ? quoteState.isinkHeight : quoteState.sinkHeight),
                material: isIrregular ? quoteState.imaterial : quoteState.material,
                finish: isIrregular ? quoteState.ifinish : quoteState.finish,
                complexity: quoteState.complexity,
                bowlConfig: quoteState.bowlConfig, aprons: quoteState.aprons, ledges: quoteState.ledges, drainboards: quoteState.drainboards,
                faucetDeck: quoteState.faucetDeck, edgeProfile: quoteState.edgeProfile, radiusCorner: quoteState.radiusCorner, faucetHole: quoteState.faucetHole, drainHole: quoteState.drainHole,
            };
        };

        const source = getSourceData();
        const basePrice = isIrregular ? BASE_IRREGULAR_SINK_PRICE : BASE_SINK_PRICE;
        const currentL = source.length || BASE_DIMENSIONS.length;
        const currentW = source.width || BASE_DIMENSIONS.width;
        const currentH = source.height || BASE_DIMENSIONS.height;

        let heightUpcharge = 0;
        if (currentH > BASE_DIMENSIONS.height) {
            if (currentH <= HEIGHT_TIER1_THRESHOLD) {
                heightUpcharge = (currentH - BASE_DIMENSIONS.height) * PRICE_PER_INCH.h_tier1;
            } else {
                heightUpcharge = ((HEIGHT_TIER1_THRESHOLD - BASE_DIMENSIONS.height) * PRICE_PER_INCH.h_tier1) + ((currentH - HEIGHT_TIER1_THRESHOLD) * PRICE_PER_INCH.h_tier2);
            }
        }
        const sizeUpcharge = (Math.max(0, currentL - BASE_DIMENSIONS.length) * PRICE_PER_INCH.lw) + (Math.max(0, currentW - BASE_DIMENSIONS.width) * PRICE_PER_INCH.lw) + heightUpcharge;
        const priceAfterSize = basePrice + sizeUpcharge;
        sinkTotal += priceAfterSize;
        breakdownHTML += createSummaryLine(`Base Price (${currentL}"x${currentW}"x${currentH}")`, priceAfterSize);

        const selectedMaterial = source.material;
        let materialSubtotal = priceAfterSize;
        let materialText = selectedMaterial.charAt(0).toUpperCase() + selectedMaterial.slice(1);
        if (materialText !== "Stainless") subItems.push(`Luxury Metal Finish: ${materialText}`);

        if (selectedMaterial !== 'stainless') {
            const materialUpcharge = priceAfterSize * (PERCENTAGES.material[selectedMaterial] || 0);
            sinkTotal += materialUpcharge;
            materialSubtotal += materialUpcharge;
            breakdownHTML += createSummaryLine(`${materialText} Upgrade`, materialUpcharge);
        }

        const selectedFinish = source.finish;
        let sinkSubtotalForLabels = sinkTotal;
        if (selectedFinish !== 'none') {
            const finishPercentage = PERCENTAGES.finish[selectedMaterial]?.[selectedFinish] || 0;
            if (finishPercentage > 0) {
                const finishUpcharge = sinkTotal * finishPercentage;
                const finishName = FINISH_OPTIONS[selectedMaterial].find(f => f.value === selectedFinish)?.text.split('(')[0].trim() || 'Finish';
                sinkTotal += finishUpcharge;
                sinkSubtotalForLabels += finishUpcharge;
                breakdownHTML += createSummaryLine(`${finishName} Finish`, finishUpcharge);
                subItems.push(`Finish: ${finishName}`);
            }
        }

        if (!leadData) {
            const newLabels = {};
            const copperLabel = `Copper (+${(PERCENTAGES.material.copper * 100).toFixed(1)}%) +${formatAsCurrency(priceAfterSize * PERCENTAGES.material.copper)}`;
            const brassLabel = `Brass (+${(PERCENTAGES.material.brass * 100).toFixed(1)}%) +${formatAsCurrency(priceAfterSize * PERCENTAGES.material.brass)}`;
            newLabels[isIrregular ? 'icopper' : 'copper'] = copperLabel;
            newLabels[isIrregular ? 'ibrass' : 'brass'] = brassLabel;

            FINISH_OPTIONS[selectedMaterial].forEach(opt => {
                if(opt.value !== 'none') {
                    const percent = PERCENTAGES.finish[selectedMaterial][opt.value];
                    const upcharge = materialSubtotal * percent;
                    newLabels[`${isIrregular ? 'i' : ''}finish_${opt.value}`] = `${opt.text} (+${(percent * 100).toFixed(1)}%) +${formatAsCurrency(upcharge)}`;
                }
            });

            const addonPercentSource = isIrregular ? { ...PERCENTAGES.addOns, ...PERCENTAGES.irregularAddOns } : PERCENTAGES.addOns;
            ['faucetDeck', 'edgeProfile', 'radiusCorner', 'faucetHole', 'drainHole'].forEach(addon => {
                const upcharge = sinkSubtotalForLabels * addonPercentSource[addon];
                newLabels[addon] = `+${formatAsCurrency(upcharge)}`;
            });

            if (isIrregular) {
                COMPLEXITY_OPTIONS.forEach(opt => {
                    if (opt.value !== 'level_1') {
                        const percent = PERCENTAGES.complexity[opt.value];
                        const upcharge = sinkSubtotalForLabels * percent;
                        newLabels[`complexity_${opt.value}`] = `${opt.text} (+${(percent * 100).toFixed(1)}%) +${formatAsCurrency(upcharge)}`;
                    }
                });
            }
            setDynamicLabels(prev => ({...prev, ...newLabels}));
        }

        const finalSinkSubtotal = sinkTotal;

        Object.entries(ADDON_DESCRIPTIONS).forEach(([key, config]) => {
            const value = source[key];
            if (value && parseFloat(value) > 0) {
                const percent = parseFloat(value);
                const upcharge = finalSinkSubtotal * percent;
                sinkTotal += upcharge;
                const name = config[value];
                if(name) {
                    breakdownHTML += createSummaryLine(name, upcharge);
                    subItems.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${name}`);
                }
            }
        });
        
        const addonPercentSource = isIrregular ? { ...PERCENTAGES.addOns, ...PERCENTAGES.irregularAddOns } : PERCENTAGES.addOns;
        const checkboxAddons = { faucetDeck: 'Integrated Faucet Deck', edgeProfile: 'Raised Edge Profile', radiusCorner: 'Radius Corner', faucetHole: 'Addtl. Faucet Hole', drainHole: 'Addtl. Drain Hole' };
        Object.keys(checkboxAddons).forEach(key => {
            if (isIrregular && key === 'radiusCorner') return;
            if (source[key]) {
                const upcharge = finalSinkSubtotal * (addonPercentSource[key] || 0);
                sinkTotal += upcharge;
                breakdownHTML += createSummaryLine(checkboxAddons[key], upcharge);
                subItems.push(checkboxAddons[key]);
            }
        });

        if (isIrregular) {
            const complexityLevel = source.complexity;
            subItems.push(`Complexity: ${COMPLEXITY_OPTIONS.find(c => c.value === complexityLevel)?.text || `Level ${complexityLevel.split('_')[1]}`}`);
            const complexityUpchargePercent = PERCENTAGES.complexity[complexityLevel] || 0;
            if (complexityUpchargePercent > 0) {
                const complexityUpcharge = sinkTotal * complexityUpchargePercent;
                sinkTotal += complexityUpcharge;
                breakdownHTML += createSummaryLine(`Complexity ${complexityLevel.split('_')[1]} Upcharge`, complexityUpcharge);
            }
        }
        
        const mainDescription = `${isIrregular ? 'Irregular ' : ''}${materialText} Sink - ${currentL}"x${currentW}"x${currentH}"`;
        return { html: breakdownHTML, total: sinkTotal, mainDescription, subItems };

    }, [quoteState]);

    const calculateBacksplashPrice = useCallback((leadData = null) => {
        const length = leadData ? leadData.dimensions.length : parseFloat(quoteState.backsplashLength) || 0;
        const width = leadData ? leadData.dimensions.width : parseFloat(quoteState.backsplashWidth) || 0;
        let edgeProfile = leadData ? (leadData.backsplashEdgeProfile || 0) : parseFloat(quoteState.backsplashEdgeProfile) || 0;
        let subItems = [];

        if (!length && !width) return { html: '<p class="text-gray-500 text-center py-4">Enter dimensions to price a backsplash.</p>', total: 0, mainDescription: '', subItems: [] };
        
        if (edgeProfile > 0 && edgeProfile < 0.375 && !leadData) {
            edgeProfile = 0.375;
            setQuoteState(prev => ({...prev, backsplashEdgeProfile: '0.375'}));
        }

        const materialKey = leadData ? leadData.material : quoteState.backsplashMaterial;
        const materialConfig = BACKSPLASH_CONFIG.materials[materialKey];
        const basePrice = materialConfig.basePrice;
        const requiredLength = length + (2 * edgeProfile);
        const requiredWidth = width + (2 * edgeProfile);
        let pieces = [{ l: length, w: width }];
        let splitMessage = '';

        if (requiredLength > BACKSPLASH_CONFIG.maxLength) {
            const numPieces = Math.ceil(requiredLength / BACKSPLASH_CONFIG.maxLength);
            pieces = Array(numPieces).fill(null).map(() => ({ l: length / numPieces, w: width }));
            splitMessage = `Material needed (${requiredLength.toFixed(1)}") exceeds max length. Job split into ${numPieces} pieces.`;
        }

        let total = 0;
        let breakdownHTML = splitMessage ? `<div class="split-notification">${splitMessage}</div>` : '';

        pieces.forEach((piece, index) => {
            let piecePrice = basePrice + ((piece.l + piece.w) * BACKSPLASH_CONFIG.pricePerInch);
            let edgeUpcharge = (edgeProfile > 0) ? ((piece.l * piece.w) / 144) * BACKSPLASH_CONFIG.edgeProfilePricePerSqFt : 0;
            let hammeredUpcharge = (materialKey === 'luxe_hammered') ? piecePrice * materialConfig.upcharge : 0;
            const totalPiecePrice = piecePrice + edgeUpcharge + hammeredUpcharge;
            total += totalPiecePrice;

            breakdownHTML += createSummaryLine(`Piece ${index + 1} (${piece.l.toFixed(1)}"x${piece.w.toFixed(1)}")`, piecePrice);
            if (hammeredUpcharge > 0) breakdownHTML += createSummaryLine(`&nbsp;&nbsp;↳ Hammered Upcharge`, hammeredUpcharge);
            if (edgeUpcharge > 0) breakdownHTML += createSummaryLine(`&nbsp;&nbsp;↳ Edge Profile Add-on`, edgeUpcharge);
        });
        
        const materialText = materialKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let mainDescription = `${length}"x${width}" ${materialText} Backsplash`;
        if (edgeProfile > 0) mainDescription += ` w/ ${edgeProfile}" Edge`;
        if (pieces.length > 1) mainDescription += ` (${pieces.length} pcs)`;

        subItems.push(`Dimensions: ${length}" x ${width}"`, `Material: ${materialText}`);
        if (edgeProfile > 0) subItems.push(`Edge Profile: ${edgeProfile}"`);
        if (pieces.length > 1) subItems.push(`Pieces: ${pieces.length}`);

        return { html: breakdownHTML, total, mainDescription, subItems };
    }, [quoteState]);
    
    // --- UseEffect Hooks for Calculations ---
    useEffect(() => {
        let result;
        if (currentItemType === 'sink') result = calculateSinkPrice(false);
        else if (currentItemType === 'irregular') result = calculateSinkPrice(true);
        else if (currentItemType === 'backsplash') result = calculateBacksplashPrice();
        else {
            setCurrentItemBreakdown({ html: '', total: 0, mainDescription: '', subItems: [] });
            return;
        }
        
        if (result && result.html) {
            const finalHtml = result.html + createSummaryLine('Total', result.total, true);
            setCurrentItemBreakdown({ html: finalHtml, total: result.total, mainDescription: result.mainDescription, subItems: result.subItems });
        }
    }, [quoteState, currentItemType, calculateSinkPrice, calculateBacksplashPrice]);

    useEffect(() => {
        const subtotal = masterQuoteItems.reduce((acc, item) => acc + item.price, 0);
        const shippingPercentage = PERCENTAGES.shipping[masterQuoteSettings.shipping] || 0;
        const shippingCost = subtotal * shippingPercentage;
        const totalBeforeTax = subtotal + shippingCost;
        const stateTax = masterQuoteSettings.tax ? totalBeforeTax * PERCENTAGES.tax.state : 0;
        const countyTax = masterQuoteSettings.tax ? totalBeforeTax * PERCENTAGES.tax.county : 0;
        const totalTax = stateTax + countyTax;
        const grandTotal = totalBeforeTax + totalTax;
        setMasterQuoteTotals({ subtotal, shippingCost, totalTax, grandTotal });
    }, [masterQuoteItems, masterQuoteSettings]);
    
    // --- Handlers: Quote Actions ---
    const handleAddItemToQuote = () => {
        if (currentItemBreakdown.total > 0) {
            setMasterQuoteItems(prev => [...prev, {
                mainDescription: currentItemBreakdown.mainDescription,
                price: currentItemBreakdown.total,
                subItems: currentItemBreakdown.subItems
            }]);
            // Reset current form
            if (currentItemType === 'sink') {
                setQuoteState(p => ({...p, sinkLength: BASE_DIMENSIONS.length, sinkWidth: BASE_DIMENSIONS.width, sinkHeight: BASE_DIMENSIONS.height, material: 'stainless', finish: 'none' }));
            } else if (currentItemType === 'irregular') {
                setQuoteState(p => ({...p, isinkLength: BASE_DIMENSIONS.length, isinkWidth: BASE_DIMENSIONS.width, isinkHeight: BASE_DIMENSIONS.height, imaterial: 'stainless', ifinish: 'none', complexity: 'level_1' }));
            } else if (currentItemType === 'backsplash') {
                setQuoteState(p => ({...p, backsplashLength: 0, backsplashWidth: 0, backsplashMaterial: 'luxe', backsplashEdgeProfile: 0 }));
            }
        }
    };
    const handleStartNewQuote = () => setMasterQuoteItems([]);

    const handleExportPdf = async (items = masterQuoteItems, totals = masterQuoteTotals, info = pdfInfo, outputType = 'save', quoteNum = null) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const config = {
            items: items, quoteNumber: quoteNum || info.quoteNumber || 'N/A', customerName: info.customerName || 'N/A', customerAddress: info.billTo || '', customerPhone: info.customerPhone || '', customerEmail: info.customerEmail || '',
            amountPaid: parseFloat(info.amountPaid) || 0, notes: info.notes || '', subtotal: totals.subtotal, shippingCost: totals.shippingCost, totalTax: totals.totalTax, grandTotal: totals.grandTotal, outputType: outputType,
        };
        const orderDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const pageHeight = doc.internal.pageSize.getHeight(), pageWidth = doc.internal.pageSize.getWidth(), margin = 15;
        
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0E2D5B'); doc.text('Official Quote', margin, 20);
        doc.setTextColor('#000000'); doc.setFont('helvetica', 'normal'); doc.text(`#${config.quoteNumber}`, margin, 26);
        doc.setFont('helvetica', 'bold'); doc.text('Client', margin, 34); doc.setFont('helvetica', 'normal'); doc.text(config.customerName, margin, 40);
        const addressDim = doc.getTextDimensions(config.customerAddress, { maxWidth: 60 });
        doc.setFont('helvetica', 'bold'); doc.text('Address', margin, 46); doc.setFont('helvetica', 'normal'); doc.text(config.customerAddress, margin, 52, { maxWidth: 60 });
        const lastY = 52 + addressDim.h;
        doc.setFont('helvetica', 'bold'); doc.text('Phone', margin, lastY + 6); doc.setFont('helvetica', 'normal'); doc.text(config.customerPhone, margin, lastY + 12);
        doc.setFont('helvetica', 'bold'); doc.text('Email', margin, lastY + 18); doc.setFont('helvetica', 'normal'); doc.text(config.customerEmail, margin, lastY + 24);
        
        doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.text('HAVENS', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(8); doc.text('LUXURY METALS', pageWidth / 2, 24, { align: 'center' });
        doc.setFontSize(7); doc.rect(pageWidth/2 - 15, 28, 30, 10); doc.text('AMERICAN\nHANDCRAFTED', pageWidth / 2, 32, { align: 'center' });

        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0E2D5B'); doc.text('Quote Date', pageWidth - margin, 20, { align: 'right' });
        doc.setTextColor('#000000'); doc.setFont('helvetica', 'normal'); doc.text(orderDate, pageWidth - margin, 26, { align: 'right' });
        doc.setFont('helvetica', 'bold'); doc.text('Havens Luxury Metals', pageWidth - margin, 34, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.text('707 W Park Ave\nEdgewater, FL 32132\nUnited States', pageWidth - margin, 40, { align: 'right' });

        const tableBody = config.items.flatMap(item => [
            [{ content: item.mainDescription, styles: { fontStyle: 'bold' } }, { content: 'x 1', styles: { halign: 'center' } }, { content: formatAsCurrency(item.price), styles: { halign: 'right' } }, { content: formatAsCurrency(item.price), styles: { halign: 'right' } }],
            ...(item.subItems?.length > 0 ? [[{ content: `  ${item.subItems.join(', ')}`, colSpan: 4, styles: { textColor: '#4b5563', fontStyle: 'italic', fontSize: 9 } }]] : [])
        ]);

        let finalTableY = 0;
        doc.autoTable({
            startY: Math.max(80, lastY + 30), head: [['Item(s)', 'Qty', 'Price', 'Total']], body: tableBody, theme: 'plain',
            headStyles: { fontStyle: 'bold', textColor: '#0E2D5B', lineColor: '#0E2D5B', lineWidth: { bottom: 0.5 } },
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 15 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
            didDrawPage: (data) => { finalTableY = data.cursor.y; }
        });

        const totalsStartY = finalTableY + 10;
        const totalsX = pageWidth - margin, totalsLabelX = totalsX - 35;
        let currentY = totalsStartY;
        
        if (config.notes) {
            doc.setFont('helvetica', 'bold').setFontSize(10).text('Notes', margin, currentY);
            doc.setFont('helvetica', 'normal').text(config.notes, margin, currentY + 6, { maxWidth: 80 });
            currentY += doc.getTextDimensions(config.notes, {maxWidth: 80}).h + 8;
        }

        let totalsY = totalsStartY > currentY ? totalsStartY : currentY;
        const drawTotalLine = (label, value, isBold=false) => {
            doc.setFont('helvetica', isBold ? 'bold' : 'normal'); doc.text(label, totalsLabelX, totalsY); doc.text(formatAsCurrency(value), totalsX, totalsY, { align: 'right'}); totalsY += 6;
        };
        drawTotalLine('Subtotal', config.subtotal);
        drawTotalLine('Shipping', config.shippingCost);
        if(config.totalTax > 0) drawTotalLine('Sales Tax', config.totalTax);
        doc.setDrawColor('#000000').setLineWidth(0.3).line(totalsLabelX - 5, totalsY, totalsX, totalsY); totalsY += 5;
        drawTotalLine('Total', config.grandTotal, true);
        if(config.amountPaid > 0) drawTotalLine('Paid', -config.amountPaid);
        
        if (config.outputType === 'blob') {
            return doc.output('blob');
        } else {
            doc.save(`Quote-${config.quoteNumber}.pdf`);
        }
    };

    // --- Corner Calculator ---
    useEffect(() => {
        const a = parseFloat(cornerCalcState.wallA), b = parseFloat(cornerCalcState.wallB), c = parseFloat(cornerCalcState.hypotenuseC);
        const update = (field, value) => setCornerCalcState(prev => ({ ...prev, [field]: value.toFixed(3) }));
        if (hypotenuseLastEdited !== 'hypotenuseC' && a && b) update('hypotenuseC', Math.sqrt(a*a + b*b));
        else if (hypotenuseLastEdited !== 'wallB' && a && c && c > a) update('wallB', Math.sqrt(c*c - a*a));
        else if (hypotenuseLastEdited !== 'wallA' && b && c && c > b) update('wallA', Math.sqrt(c*c - b*b));
    }, [cornerCalcState.wallA, cornerCalcState.wallB, cornerCalcState.hypotenuseC, hypotenuseLastEdited]);

    const handleApplyCornerDimensions = () => {
        setQuoteState(prev => ({...prev, isinkLength: cornerCalcState.hypotenuseC, isinkWidth: cornerCalcState.armWidth}));
        toggleModal('cornerCalc', false);
    };

    // --- AI Assistant ---
    const handleAnalyzeLeads = async () => {
        if (!crmData.trim()) return alert("Please paste some CRM data first.");
        setAiLoading(true);
        try {
            const response = await fetch('/api/analyze-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ crmData }),
            });
            if (!response.ok) throw new Error(await response.text());
            const leads = await response.json();
            setParsedLeads(leads);
            toggleModal('aiResults', true);
        } catch (error) {
            console.error("Error analyzing leads:", error);
            alert("An error occurred while analyzing the leads.");
        } finally {
            setAiLoading(false);
        }
    };
    const handleGenerateAiQuotes = () => {
        if (!parsedLeads?.quoteReadyLeads?.length) return;
        const quotes = parsedLeads.quoteReadyLeads.map(lead => {
            let result;
            if (lead.productType === 'sink' || lead.productType === 'irregular_sink') result = calculateSinkPrice(lead.productType === 'irregular_sink', lead);
            else if (lead.productType === 'backsplash') result = calculateBacksplashPrice(lead);
            if(result && result.total > 0) return { leadData: lead, quoteItem: { mainDescription: result.mainDescription, subItems: result.subItems, price: result.total } };
            return null;
        }).filter(Boolean);
        setAiGeneratedQuotes(quotes);
        setParsedLeads(null);
        setCrmData('');
        toggleModal('aiResults', false);
        toggleModal('aiExport', true);
    };
    const handleCopyFollowUps = () => {
        if (!parsedLeads?.followUpLeads?.length) return;
        const tsv = ["Customer Name", "Reason for Follow-up", "Original Data"].join('\t') + '\n' +
            parsedLeads.followUpLeads.map(l => [l.customerName || 'N/A', l.reason, l.originalData].join('\t')).join('\n');
        navigator.clipboard.writeText(tsv).then(() => showToast(setShowCopyConfirmation));
    };
    const handleExportSingleAiQuote = async (index) => {
        const quote = aiGeneratedQuotes[index];
        const subtotal = quote.quoteItem.price;
        const shippingCost = subtotal * (PERCENTAGES.shipping[aiExportSettings.shipping] || 0);
        const totalBeforeTax = subtotal + shippingCost;
        const totalTax = aiExportSettings.tax ? totalBeforeTax * (PERCENTAGES.tax.state + PERCENTAGES.tax.county) : 0;
        const grandTotal = totalBeforeTax + totalTax;
        const totals = { subtotal, shippingCost, totalTax, grandTotal };
        const quoteNumber = `${quote.leadData.customerName.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}`;
        await handleExportPdf([quote.quoteItem], totals, { customerName: quote.leadData.customerName }, 'save', quoteNumber);
    };
    const handleExportAllAiQuotesAsZip = async () => {
        if (aiGeneratedQuotes.length === 0) return;
        setZipping(true);
        try {
            const zip = new window.JSZip();
            for (const quote of aiGeneratedQuotes) {
                const subtotal = quote.quoteItem.price;
                const shippingCost = subtotal * (PERCENTAGES.shipping[aiExportSettings.shipping] || 0);
                const totalBeforeTax = subtotal + shippingCost;
                const totalTax = aiExportSettings.tax ? totalBeforeTax * (PERCENTAGES.tax.state + PERCENTAGES.tax.county) : 0;
                const grandTotal = totalBeforeTax + totalTax;
                const totals = { subtotal, shippingCost, totalTax, grandTotal };
                const quoteNumber = `${quote.leadData.customerName.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}`;
                const pdfBlob = await handleExportPdf([quote.quoteItem], totals, { customerName: quote.leadData.customerName }, 'blob', quoteNumber);
                zip.file(`Quote_${quoteNumber}.pdf`, pdfBlob);
            }
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `Havens_Quotes_${new Date().toISOString().split('T')[0]}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch(e) { console.error(e); }
        finally { setZipping(false); }
    };
    
    // --- Email Helper ---
    useEffect(() => {
        const stored = localStorage.getItem('emailTemplates');
        if (stored) setEmailTemplates(JSON.parse(stored));
    }, []);
    useEffect(() => {
        localStorage.setItem('emailTemplates', JSON.stringify(emailTemplates));
    }, [emailTemplates]);

    const handleSelectTemplate = (id) => {
        setSelectedTemplateId(id);
        const template = emailTemplates.find(t => t.id === id);
        if (template) {
            if (emailEditorRef.current) emailEditorRef.current.innerHTML = template.content;
            setCurrentAttachment(template.attachment);
            setIsEditingEmail(false);

            const needsVars = /\{\{(customerName|quoteNumber|balanceDue|customerAddress)\}\}/.test(template.content);
            if (needsVars) {
                setTemplateVars({ customerName: '', quoteNumber: '', balanceDue: '', customerAddress: '' });
                toggleModal('templateVars', true);
            }
        } else {
             if (emailEditorRef.current) emailEditorRef.current.innerHTML = '';
             setCurrentAttachment(null);
             setIsEditingEmail(false);
        }
    };
    const handleNewTemplate = () => {
        setSelectedTemplateId('');
        if (emailEditorRef.current) emailEditorRef.current.innerHTML = '';
        setCurrentAttachment(null);
        setIsEditingEmail(true);
    };
    const handleEditRequest = () => {
        setPasscode('');
        setPasscodeError(false);
        toggleModal('passcode', true);
    };
    const handleConfirmPasscode = () => {
        if (passcode === EDIT_PASSCODE) {
            toggleModal('passcode', false);
            setIsEditingEmail(true);
        } else {
            setPasscodeError(true);
        }
    };
    const handleOpenSaveModal = () => {
        const existing = emailTemplates.find(t => t.id === selectedTemplateId);
        setModalTemplateName(existing ? existing.name : '');
        toggleModal('saveTemplate', true);
    };
    const handleConfirmSave = () => {
        if (!modalTemplateName.trim()) return alert("Please enter a template name.");
        const content = emailEditorRef.current.innerHTML;
        const isUpdating = !!selectedTemplateId;
        let newId = selectedTemplateId;

        if (isUpdating) {
            setEmailTemplates(prev => prev.map(t => t.id === selectedTemplateId ? {...t, name: modalTemplateName, content, attachment: currentAttachment } : t));
        } else {
            newId = Date.now().toString();
            setEmailTemplates(prev => [...prev, { id: newId, name: modalTemplateName, content, attachment: currentAttachment }]);
        }
        toggleModal('saveTemplate', false);
        setSelectedTemplateId(newId);
        setIsEditingEmail(false);
        showToast(setShowEmailCopyConf);
    };
    const handleConfirmDelete = () => {
        setEmailTemplates(prev => prev.filter(t => t.id !== selectedTemplateId));
        setSelectedTemplateId('');
        if(emailEditorRef.current) emailEditorRef.current.innerHTML = '';
        setCurrentAttachment(null);
        toggleModal('deleteConfirm', false);
    };
    const handleApplyTemplateVars = () => {
        let content = emailTemplates.find(t => t.id === selectedTemplateId)?.content || '';
        content = content.replace(/\{\{customerName\}\}/g, templateVars.customerName || '');
        content = content.replace(/\{\{quoteNumber\}\}/g, templateVars.quoteNumber || '');
        content = content.replace(/\{\{balanceDue\}\}/g, templateVars.balanceDue || '');
        content = content.replace(/\{\{customerAddress\}\}/g, templateVars.customerAddress || '');
        if(emailEditorRef.current) emailEditorRef.current.innerHTML = content;
        toggleModal('templateVars', false);
    };
    const handleCopyEmail = () => {
        const template = emailTemplates.find(t => t.id === selectedTemplateId);
        const content = emailEditorRef.current?.innerHTML;
        if (!template || !content) return;
        const blob = new Blob([content], { type: 'text/html' });
        navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]).then(() => {
            if (template.attachment?.data) {
                const link = document.createElement('a');
                link.href = template.attachment.data;
                link.download = template.attachment.name;
                link.click();
            }
            showToast(setShowEmailCopyConf);
        });
    };
    const handleAttachmentChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setCurrentAttachment(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => setCurrentAttachment({ name: file.name, type: file.type, data: ev.target.result });
        reader.readAsDataURL(file);
    };
    const selectedTemplate = emailTemplates.find(t => t.id === selectedTemplateId);

    // --- RENDER ---
    const renderDashboard = () => (
        <div id="dashboard-view">
            <header className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 tracking-tight">Sales Toolkit</h1>
                <p className="text-gray-600 mt-3 text-lg">Your central hub for sales and quoting tools.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div onClick={() => { setCurrentItemType('sink'); setCurrentView('quote-builder'); }} className="tool-card">
                    <div className="tool-card-icon bg-indigo-100 text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10M18 20V4M6 20V16"></path></svg></div>
                    <h2 className="tool-card-title">Quote Builder</h2>
                    <p className="tool-card-description">Manually build quotes or use the AI Assistant to process bulk leads.</p>
                </div>
                <div onClick={() => setCurrentView('email-helper')} className="tool-card">
                     <div className="tool-card-icon bg-green-100 text-green-600"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></div>
                    <h2 className="tool-card-title">Email Helper</h2>
                    <p className="tool-card-description">Create, manage, and quickly use pre-made email templates.</p>
                </div>
            </div>
        </div>
    );
    
    const renderQuoteBuilder = () => {
        const isTextured = quoteState.finish === 'prestige' || quoteState.ifinish === 'prestige';
        const isHighComplexityIrregular = currentItemType === 'irregular' && ['level_2', 'level_3'].includes(quoteState.complexity);
        
        return (
            <div id="quote-builder-view">
                <header className="text-center mb-8">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setCurrentView('dashboard')} className="back-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>Dashboard</button>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 tracking-tight">Havens Metal Quote Builder</h1>
                        <div className="w-28"></div>
                    </div>
                    <p className="text-gray-600 mt-2">Build a custom quote item by item, or use the AI Assistant for bulk leads.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
                    {/* Left Panel */}
                    <div id="left-panel" className="lg:col-span-1">
                        <div className="flex gap-4 mb-6">
                            {['sink', 'irregular', 'backsplash', 'ai-parser'].map(type => (
                                <button key={type} onClick={() => setCurrentItemType(type)} className={`tab-btn ${currentItemType === type ? 'active' : ''}`}>
                                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </button>
                            ))}
                        </div>
                        
                        {/* Sink */}
                        <div className={currentItemType === 'sink' ? '' : 'hidden'}>
                            <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Sink Dimensions</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div><label className="form-label">Length (in)</label><input type="number" name="sinkLength" value={quoteState.sinkLength} onChange={handleQuoteChange} className="form-input" step="0.5"/></div>
                                    <div><label className="form-label">Width (in)</label><input type="number" name="sinkWidth" value={quoteState.sinkWidth} onChange={handleQuoteChange} className="form-input" step="0.5"/></div>
                                    <div><label className="form-label">Height (in)</label><input type="number" name="sinkHeight" value={quoteState.sinkHeight} onChange={handleQuoteChange} className="form-input" step="0.5"/></div>
                                </div>
                            </div>
                            <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Sink Material & Finish</h2>
                                <label className="form-label">Material</label>
                                <select name="material" value={quoteState.material} onChange={handleQuoteChange} className="form-select mb-4">
                                    <option value="stainless">Stainless Steel</option>
                                    <option value="copper">{dynamicLabels.copper || 'Copper'}</option>
                                    <option value="brass">{dynamicLabels.brass || 'Brass'}</option>
                                </select>
                                <label className="form-label">Finish</label>
                                <select name="finish" value={quoteState.finish} onChange={handleQuoteChange} className="form-select">
                                    {FINISH_OPTIONS[quoteState.material].map(opt => <option key={opt.value} value={opt.value}>{dynamicLabels[`finish_${opt.value}`] || opt.text}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Irregular Sink */}
                        <div className={currentItemType === 'irregular' ? '' : 'hidden'}>
                             <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Irregular Sink Details</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div><label className="form-label">Length (in)</label><input type="number" name="isinkLength" value={quoteState.isinkLength} onChange={handleQuoteChange} className="form-input" step="0.5"/></div>
                                    <div><label className="form-label">Width (in)</label><input type="number" name="isinkWidth" value={quoteState.isinkWidth} onChange={handleQuoteChange} className="form-input" step="0.5"/></div>
                                    <div><label className="form-label">Height (in)</label><input type="number" name="isinkHeight" value={quoteState.isinkHeight} onChange={handleQuoteChange} className="form-input" step="0.5"/></div>
                                </div>
                                <div className="mt-4">
                                    <label className="form-label">Complexity Level</label>
                                    <select name="complexity" value={quoteState.complexity} onChange={handleQuoteChange} className="form-select">
                                        {COMPLEXITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value} dangerouslySetInnerHTML={{__html: dynamicLabels[`complexity_${opt.value}`] || opt.text}} />)}
                                    </select>
                                </div>
                                {quoteState.complexity === 'level_1' && <div className="mt-4"><button onClick={() => toggleModal('cornerCalc', true)} className="w-full bg-indigo-100 text-indigo-700 py-2 rounded-lg font-semibold hover:bg-indigo-200 transition-colors">Open Corner Calculator</button></div>}
                            </div>
                            <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Material & Finish</h2>
                                <label className="form-label">Material</label>
                                <select name="imaterial" value={quoteState.imaterial} onChange={handleQuoteChange} className="form-select mb-4">
                                    <option value="stainless" disabled={isHighComplexityIrregular}>Stainless Steel</option>
                                    <option value="copper">{dynamicLabels.icopper || 'Copper'}</option>
                                    <option value="brass">{dynamicLabels.ibrass || 'Brass'}</option>
                                </select>
                                <label className="form-label">Finish</label>
                                <select name="ifinish" value={quoteState.ifinish} onChange={handleQuoteChange} className="form-select">
                                    {FINISH_OPTIONS[quoteState.imaterial].map(opt => <option key={opt.value} value={opt.value}>{dynamicLabels[`ifinish_${opt.value}`] || opt.text}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Backsplash */}
                        <div className={currentItemType === 'backsplash' ? '' : 'hidden'}>
                            <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Backsplash Details</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="form-label">Length (in)</label><input type="number" name="backsplashLength" value={quoteState.backsplashLength} onChange={handleQuoteChange} className="form-input" step="0.125"/></div>
                                    <div><label className="form-label">Width (in)</label><input type="number" name="backsplashWidth" value={quoteState.backsplashWidth} onChange={handleQuoteChange} className="form-input" step="0.125"/></div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div><label className="form-label">Material</label><select name="backsplashMaterial" value={quoteState.backsplashMaterial} onChange={handleQuoteChange} className="form-select"><option value="luxe">Luxe</option><option value="textured">Textured</option><option value="luxe_hammered">Luxe Hammered</option></select></div>
                                    <div><label className="form-label">Edge Profile (in)</label><input type="number" name="backsplashEdgeProfile" value={quoteState.backsplashEdgeProfile} onChange={handleQuoteChange} className="form-input" step="0.125" min="0"/></div>
                                </div>
                            </div>
                        </div>

                        {/* AI Assistant */}
                        <div className={`relative ${currentItemType === 'ai-parser' ? '' : 'hidden'}`}>
                            {aiLoading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20"><div className="loader"></div><p className="mt-4 text-lg font-semibold text-gray-700">Analyzing your leads...</p></div>}
                            <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">AI Assistant</h2>
                                <p className="text-gray-600 mb-4">Paste raw lead data from your CRM below.</p>
                                <textarea value={crmData} onChange={e => setCrmData(e.target.value)} className="form-input" rows="10" placeholder="e.g., John Doe, wants a 33x22x10 copper sink..."></textarea>
                                <button onClick={handleAnalyzeLeads} disabled={aiLoading} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400">Analyze Leads</button>
                            </div>
                        </div>

                        {/* Breakdown */}
                        {currentItemType !== 'ai-parser' && 
                            <div className="summary-section">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-3">{currentItemType.replace('-', ' ').replace(/\b\w/g, l=>l.toUpperCase())} Breakdown</h2>
                                <div dangerouslySetInnerHTML={{__html: currentItemBreakdown.html}}></div>
                                <button onClick={handleAddItemToQuote} disabled={!currentItemBreakdown.total} className="w-full mt-6 bg-yellow-700 text-white py-3 rounded-lg font-semibold hover:bg-yellow-800 transition-colors disabled:bg-yellow-500">Add to Quote</button>
                            </div>
                        }
                    </div>

                    {/* Right Panel */}
                    <div id="right-panel" className="lg:col-span-1 lg:sticky top-8 h-min">
                        {['sink', 'irregular'].includes(currentItemType) &&
                             <div className="calculator-section">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Sink Add-Ons</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    {Object.keys(ADDON_DESCRIPTIONS).map(key => (
                                        <div key={key}><label className="form-label">{key.charAt(0).toUpperCase() + key.slice(1)}</label><select name={key} value={quoteState[key]} onChange={handleQuoteChange} className="form-select" disabled={isHighComplexityIrregular && ['ledges', 'drainboards'].includes(key)}><option value="0">None</option>{Object.entries(ADDON_DESCRIPTIONS[key]).map(([val, desc]) => <option key={val} value={val}>{desc}</option>)}</select></div>
                                    ))}
                                </div>
                                <div className="space-y-3 pt-4 border-t">
                                    <label className="checkbox-label"><input type="checkbox" name="faucetDeck" checked={quoteState.faucetDeck} onChange={handleQuoteChange} /><span className="option-text">Integrated Faucet Deck <span className="option-price">{dynamicLabels.faucetDeck}</span></span></label>
                                    <label className="checkbox-label"><input type="checkbox" name="edgeProfile" checked={quoteState.edgeProfile} onChange={handleQuoteChange} /><span className="option-text">Raised Edge Profile <span className="option-price">{dynamicLabels.edgeProfile}</span></span></label>
                                    {currentItemType !== 'irregular' && <label className={`checkbox-label ${isTextured ? 'disabled' : ''}`}><input type="checkbox" name="radiusCorner" checked={quoteState.radiusCorner} onChange={handleQuoteChange} disabled={isTextured}/><span className="option-text">Radius Corner <span className="option-price">{dynamicLabels.radiusCorner}</span></span></label>}
                                    <label className="checkbox-label"><input type="checkbox" name="faucetHole" checked={quoteState.faucetHole} onChange={handleQuoteChange} /><span className="option-text">Addtl. Faucet Hole <span className="option-price">{dynamicLabels.faucetHole}</span></span></label>
                                    <label className="checkbox-label"><input type="checkbox" name="drainHole" checked={quoteState.drainHole} onChange={handleQuoteChange} /><span className="option-text">Addtl. Drain Hole <span className="option-price">{dynamicLabels.drainHole}</span></span></label>
                                </div>
                            </div>
                        }

                        <div className="summary-section">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-3">Customer & Quote Info</h2>
                            <div className="space-y-4">
                                <div><label className="form-label">Quote #</label><input type="text" name="quoteNumber" value={pdfInfo.quoteNumber} onChange={handlePdfInfoChange} className="form-input"/></div>
                                <div><label className="form-label">Client Name</label><input type="text" name="customerName" value={pdfInfo.customerName} onChange={handlePdfInfoChange} className="form-input"/></div>
                                <div><label className="form-label">Client Address</label><textarea name="billTo" value={pdfInfo.billTo} onChange={handlePdfInfoChange} className="form-input" rows="3"/></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="form-label">Client Phone</label><input type="text" name="customerPhone" value={pdfInfo.customerPhone} onChange={handlePdfInfoChange} className="form-input"/></div>
                                    <div><label className="form-label">Client Email</label><input type="email" name="customerEmail" value={pdfInfo.customerEmail} onChange={handlePdfInfoChange} className="form-input"/></div>
                                </div>
                                <div><label className="form-label">Amount Paid</label><input type="number" name="amountPaid" value={pdfInfo.amountPaid} onChange={handlePdfInfoChange} className="form-input" step="0.01"/></div>
                                <div><label className="form-label">Invoice Notes</label><textarea name="notes" value={pdfInfo.notes} onChange={handlePdfInfoChange} className="form-input" rows="3"/></div>
                            </div>
                        </div>

                        <div className="summary-section">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-3">Master Quote</h2>
                            {masterQuoteItems.length > 0 ?
                                masterQuoteItems.map((item, index) => <div key={index} className="summary-line"><span>{index + 1}. {item.mainDescription}</span><span className="font-medium">{formatAsCurrency(item.price)}</span></div>)
                                : <p className="text-gray-500 text-center py-4">No items added yet.</p>
                            }
                            {masterQuoteItems.length > 0 &&
                                <>
                                    <div className="summary-line font-bold"><span>Subtotal</span><span>{formatAsCurrency(masterQuoteTotals.subtotal)}</span></div>
                                    <div className="calculator-section p-4 mt-4">
                                        <label className="form-label !mb-2">Shipping Destination</label>
                                        <select name="shipping" value={masterQuoteSettings.shipping} onChange={handleMasterQuoteSettingsChange} className="form-select mb-2"><option value="standard">USA - Standard (4.5%)</option><option value="custom">USA - Custom/Freight (7.5%)</option><option value="canada">Canada (9%)</option><option value="local">Local Pickup (No Charge)</option></select>
                                        <label className="checkbox-label !p-2"><input type="checkbox" name="tax" checked={masterQuoteSettings.tax} onChange={handleMasterQuoteSettingsChange}/><span className="option-text">Apply Florida Sales Tax</span></label>
                                    </div>
                                    <div className="summary-line"><span>Shipping</span><span>{formatAsCurrency(masterQuoteTotals.shippingCost)}</span></div>
                                    <div className="summary-line"><span>Sales Tax</span><span>{formatAsCurrency(masterQuoteTotals.totalTax)}</span></div>
                                    <div className="summary-line mt-4 pt-4 border-t-2 border-gray-300"><span className="summary-total">Grand Total</span><span className="summary-total">{formatAsCurrency(masterQuoteTotals.grandTotal)}</span></div>
                                    <div className="flex gap-4 mt-6">
                                        <button onClick={handleStartNewQuote} className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-800">Start New</button>
                                        <button onClick={() => handleExportPdf()} className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800">Export PDF</button>
                                    </div>
                                </>
                            }
                        </div>
                    </div>
                </div>

                <button onClick={() => toggleModal('guide', true)} className="guide-btn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg></button>
            </div>
        )
    };
    
    const renderEmailHelper = () => (
         <div id="email-helper-view">
            <header className="text-center mb-8">
                <div className="flex justify-between items-center">
                    <button onClick={() => setCurrentView('dashboard')} className="back-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>Dashboard</button>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800 tracking-tight">Email Helper</h1>
                    <div className="w-28"></div>
                </div>
                <p className="text-gray-600 mt-2">Create and manage reusable email templates.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                <div className="md:col-span-1">
                    <div className="calculator-section">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Templates</h2>
                        <select value={selectedTemplateId} onChange={e => handleSelectTemplate(e.target.value)} disabled={isEditingEmail} className="form-select mb-4">
                            <option value="">Select a template...</option>
                            {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button onClick={handleNewTemplate} disabled={isEditingEmail} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-400">New Template</button>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <div className="calculator-section">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-700">Editor</h2>
                            <div className="flex gap-2 items-center flex-wrap">
                                {isEditingEmail ? (
                                    <>
                                        <button onClick={handleOpenSaveModal} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700">Save</button>
                                        <button onClick={() => { setIsEditingEmail(false); handleSelectTemplate(selectedTemplateId); }} className="font-semibold text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
                                    </>
                                ) : selectedTemplateId && (
                                    <>
                                        <button onClick={handleEditRequest} className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-700">Edit</button>
                                        <button onClick={() => toggleModal('deleteConfirm', true)} className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700">Delete</button>
                                        <button onClick={handleCopyEmail} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700">{selectedTemplate?.attachment ? 'Copy & Download' : 'Copy Email'}</button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="editor-toolbar">
                            {['bold', 'italic', 'underline', 'insertUnorderedList'].map(cmd => <button key={cmd} className="toolbar-btn" onMouseDown={e => {e.preventDefault(); document.execCommand(cmd, false)}}><span className={`font-${cmd}`}>{cmd.charAt(0).toUpperCase()}</span></button>)}
                        </div>
                        <div ref={emailEditorRef} contentEditable={isEditingEmail} className={`form-input ${isEditingEmail ? 'editing' : ''}`} style={{minHeight: '300px'}}></div>
                        {(selectedTemplateId || isEditingEmail) &&
                            <div className="mt-4">
                                <label className="form-label text-sm font-semibold">Attachment</label>
                                {currentAttachment && !isEditingEmail ?
                                    <div className="items-center justify-between p-2 pl-3 bg-gray-100 rounded-md border"><span className="text-sm font-medium text-gray-800">{currentAttachment.name}</span></div>
                                    : isEditingEmail && (
                                        currentAttachment ? 
                                        <div className="flex items-center justify-between p-2 pl-3 bg-gray-100 rounded-md border">
                                            <span className="text-sm font-medium text-gray-800">{currentAttachment.name}</span>
                                            <button onClick={() => {setCurrentAttachment(null); if(attachmentInputRef.current) attachmentInputRef.current.value = '';}} className="flex-shrink-0 text-red-500 hover:text-red-700 text-xl font-bold">&times;</button>
                                        </div>
                                        : <input type="file" ref={attachmentInputRef} onChange={handleAttachmentChange} className="form-input text-sm p-2 h-auto" />
                                    )
                                }
                            </div>
                        }
                        <p className="text-xs text-gray-500 mt-2">Use {'{{customerName}}'}, {'{{quoteNumber}}'}, etc. for dynamic fields.</p>
                        {showEmailCopyConf && <p className="text-sm text-green-600 font-medium h-5 mt-2">Success!</p>}
                    </div>
                </div>
            </div>
        </div>
    );
    
    return (
        <div className="bg-gray-100 p-4 md:p-8 min-h-screen">
            <div id="app-container">
                {currentView === 'dashboard' && renderDashboard()}
                {currentView === 'quote-builder' && renderQuoteBuilder()}
                {currentView === 'email-helper' && renderEmailHelper()}
            </div>
            
            {/* Modals */}
            {modals.guide && 
                <div className="modal-overlay active">
                    <div className="modal-content max-w-xl">
                        <button onClick={() => toggleModal('guide', false)} className="modal-close-btn">&times;</button>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Pricing Guide</h2>
                         <div className="space-y-4 text-gray-600 max-h-[70vh] overflow-y-auto pr-4">
                            <h3 className="font-bold text-lg text-gray-800 border-b pb-2">Sink Pricing</h3>
                            <p><strong>Base Price:</strong> Starts at {formatAsCurrency(BASE_SINK_PRICE)} for a standard sink and {formatAsCurrency(BASE_IRREGULAR_SINK_PRICE)} for irregular shapes.</p>
                            <p><strong>Dimensions:</strong> Base size is {BASE_DIMENSIONS.length}"x{BASE_DIMENSIONS.width}"x{BASE_DIMENSIONS.height}". Each inch over base L/W adds {formatAsCurrency(PRICE_PER_INCH.lw)}. Height adds {formatAsCurrency(PRICE_PER_INCH.h_tier1)}/in up to {HEIGHT_TIER1_THRESHOLD}", then {formatAsCurrency(PRICE_PER_INCH.h_tier2)}/in.</p>
                            <p><strong>Material Upgrades:</strong> Copper adds ~26%, Brass adds ~52% to the size-adjusted price.</p>
                            <p><strong>Finishes:</strong> Prestige and Hammered finishes are a percentage of the material-adjusted price. Percentages vary by material.</p>
                            <p><strong>Add-ons:</strong> Most add-ons (like ledges, drainboards, faucet decks) are a percentage of the total sink price *before* the add-on is applied.</p>
                            <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mt-6">Backsplash Pricing</h3>
                            <p><strong>Pricing:</strong> Calculated based on a base price per material, plus a charge per linear inch of the perimeter ({formatAsCurrency(BACKSPLASH_CONFIG.pricePerInch)}/inch).</p>
                            <p><strong>Edge Profile:</strong> Adds {formatAsCurrency(BACKSPLASH_CONFIG.edgeProfilePricePerSqFt)} per square foot. Minimum required edge is 0.375".</p>
                            <p><strong>Splitting:</strong> Jobs requiring material longer than {BACKSPLASH_CONFIG.maxLength}" will be automatically split into multiple pieces.</p>
                            <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mt-6">AI Assistant</h3>
                            <p>Paste raw text from your CRM. The AI will parse it into two lists: leads ready for quoting, and leads that need more information. You can then generate and export quotes in bulk.</p>
                        </div>
                    </div>
                </div>
            }
            {modals.cornerCalc && 
                <div className="modal-overlay active">
                    <div className="modal-content">
                        <button onClick={() => toggleModal('cornerCalc', false)} className="modal-close-btn">&times;</button>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Corner Sink Calculator</h2>
                        <div className="space-y-4">
                             <div><label className="form-label">Wall A (Overall Width)</label><input type="number" value={cornerCalcState.wallA} onChange={e => {setCornerCalcState(p => ({...p, wallA: e.target.value})); setHypotenuseLastEdited('wallA');}} className="form-input" /></div>
                             <div><label className="form-label">Wall B (Overall Length)</label><input type="number" value={cornerCalcState.wallB} onChange={e => {setCornerCalcState(p => ({...p, wallB: e.target.value})); setHypotenuseLastEdited('wallB');}} className="form-input" /></div>
                             <div><label className="form-label">Length (D - Hypotenuse)</label><input type="number" value={cornerCalcState.hypotenuseC} onChange={e => {setCornerCalcState(p => ({...p, hypotenuseC: e.target.value})); setHypotenuseLastEdited('hypotenuseC');}} className="form-input" /></div>
                             <div><label className="form-label">Width (C - Arm Width)</label><input type="number" value={cornerCalcState.armWidth} onChange={e => setCornerCalcState(p => ({...p, armWidth: e.target.value}))} className="form-input" /></div>
                        </div>
                        <button onClick={handleApplyCornerDimensions} className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold">Apply Dimensions</button>
                    </div>
                </div>
            }
            {modals.aiResults &&
                <div className="modal-overlay active">
                    <div className="modal-content w-full max-w-lg text-left">
                        <button onClick={() => toggleModal('aiResults', false)} className="modal-close-btn">&times;</button>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Analysis Complete!</h2>
                        <div className="text-gray-700 space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-4">
                            <p>Found <strong>{parsedLeads?.quoteReadyLeads?.length || 0}</strong> lead(s) ready for a quote.</p>
                            {parsedLeads?.followUpLeads?.length > 0 && <>
                                <p>Found <strong>{parsedLeads.followUpLeads.length}</strong> lead(s) that need follow-up:</p>
                                <ul className="follow-up-list">{parsedLeads.followUpLeads.map((lead, i) => <li key={i}><strong>{lead.customerName || 'Unknown'}</strong>: {lead.reason}</li>)}</ul>
                            </>}
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={handleGenerateAiQuotes} disabled={!parsedLeads?.quoteReadyLeads?.length} className="flex-grow bg-green-600 text-white py-3 rounded-lg font-semibold disabled:bg-gray-400">Generate {parsedLeads?.quoteReadyLeads?.length || 0} Quote(s)</button>
                            {parsedLeads?.followUpLeads?.length > 0 && <button onClick={handleCopyFollowUps} className="p-3 bg-gray-200 rounded-lg">Copy</button>}
                        </div>
                        {showCopyConfirmation && <p className="text-sm text-green-600 text-center mt-2">Copied!</p>}
                    </div>
                </div>
            }
            {modals.aiExport && 
                 <div className="modal-overlay active">
                    <div className="modal-content w-full max-w-3xl">
                        <button onClick={() => toggleModal('aiExport', false)} className="modal-close-btn">&times;</button>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Generated Quotes</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
                            <div><label className="form-label !mb-2">Shipping</label><select value={aiExportSettings.shipping} onChange={e => setAiExportSettings(p=>({...p, shipping: e.target.value}))} className="form-select"><option value="standard">USA - Standard (4.5%)</option><option value="custom">USA - Custom/Freight (7.5%)</option><option value="canada">Canada (9%)</option><option value="local">Local Pickup (No Charge)</option></select></div>
                            <div><label className="form-label !mb-2 opacity-0">Tax</label><label className="checkbox-label !p-2 mt-2"><input type="checkbox" checked={aiExportSettings.tax} onChange={e => setAiExportSettings(p=>({...p, tax: e.target.checked}))} /><span className="option-text">Apply Florida Sales Tax</span></label></div>
                        </div>
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 border-t border-b py-4">
                            {aiGeneratedQuotes.map((q, i) => <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border"><div><p className="font-semibold">{q.leadData.customerName}</p><p className="text-sm text-gray-600">{q.quoteItem.mainDescription} - <span className="font-medium">{formatAsCurrency(q.quoteItem.price)}</span></p></div><button onClick={() => handleExportSingleAiQuote(i)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Export PDF</button></div>)}
                        </div>
                        <div className="mt-8 flex justify-between items-center gap-4">
                            <button onClick={handleExportAllAiQuotesAsZip} disabled={zipping} className="bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold w-full">{zipping ? 'Zipping...' : 'Export All as .ZIP'}</button>
                            <button onClick={() => toggleModal('aiExport', false)} className="bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold">Close</button>
                        </div>
                    </div>
                </div>
            }
            {modals.saveTemplate &&
                <div className="modal-overlay active">
                    <div className="modal-content w-full max-w-md">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{selectedTemplateId ? 'Update' : 'Save'} Template</h2>
                        <div>
                            <label htmlFor="templateName" className="form-label">Template Name</label>
                            <input
                                id="templateName"
                                type="text"
                                value={modalTemplateName}
                                onChange={e => setModalTemplateName(e.target.value)}
                                className="form-input"
                                placeholder="e.g., Follow-up on Quote"
                            />
                        </div>
                        <div className="flex gap-4 mt-6">
                            <button onClick={() => toggleModal('saveTemplate', false)} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold">Cancel</button>
                            <button onClick={handleConfirmSave} className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold">Confirm</button>
                        </div>
                    </div>
                </div>
            }
            {modals.deleteConfirm &&
                <div className="modal-overlay active">
                    <div className="modal-content w-full max-w-md text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Are you sure?</h2>
                        <p className="text-gray-600 mb-6">This will permanently delete the template "<span className="font-semibold">{selectedTemplate?.name}</span>". This action cannot be undone.</p>
                        <div className="flex gap-4 mt-6">
                             <button onClick={() => toggleModal('deleteConfirm', false)} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold">Cancel</button>
                            <button onClick={handleConfirmDelete} className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold">Yes, Delete</button>
                        </div>
                    </div>
                </div>
            }
            {modals.passcode &&
                <div className="modal-overlay active">
                    <div className="modal-content w-full max-w-sm">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Enter Passcode</h2>
                        <p className="text-gray-600 mb-4">Editing is restricted. Please enter the passcode to continue.</p>
                        <input
                            type="password"
                            value={passcode}
                            onChange={e => { setPasscode(e.target.value); setPasscodeError(false); }}
                            className={`form-input ${passcodeError ? 'border-red-500' : ''}`}
                            placeholder="Passcode"
                        />
                        {passcodeError && <p className="text-red-500 text-sm mt-1">Incorrect passcode.</p>}
                        <div className="flex gap-4 mt-6">
                             <button onClick={() => toggleModal('passcode', false)} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold">Cancel</button>
                            <button onClick={handleConfirmPasscode} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold">Confirm</button>
                        </div>
                    </div>
                </div>
            }
            {modals.templateVars &&
                <div className="modal-overlay active">
                    <div className="modal-content w-full max-w-md">
                        <button onClick={() => toggleModal('templateVars', false)} className="modal-close-btn">&times;</button>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Fill in Template Variables</h2>
                        <p className="text-gray-600 mb-4">This template uses dynamic fields. Fill them in below.</p>
                        <div className="space-y-3">
                            {Object.keys(templateVars).map(key => (
                                <div key={key}>
                                    <label className="form-label text-sm">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                    <input type="text" value={templateVars[key]} onChange={e => setTemplateVars(p => ({...p, [key]: e.target.value}))} className="form-input"/>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4 mt-6">
                            <button onClick={() => toggleModal('templateVars', false)} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold">Skip</button>
                            <button onClick={handleApplyTemplateVars} className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold">Apply Variables</button>
                        </div>
                    </div>
                </div>
            }
        </div>
    );
}
