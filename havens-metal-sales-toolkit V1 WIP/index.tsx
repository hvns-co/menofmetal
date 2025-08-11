

import { GoogleGenAI, Type } from "@google/genai";

declare const jspdf: any;
declare const JSZip: any;

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

// --- DOM ELEMENTS ---
const views = {
    dashboard: document.getElementById('dashboard-view') as HTMLDivElement,
    'quote-builder': document.getElementById('quote-builder-view') as HTMLDivElement,
    'email-helper': document.getElementById('email-helper-view') as HTMLDivElement,
};

const inputs = {
    // Quote Builder
    sinkLength: document.getElementById('sinkLength') as HTMLInputElement, sinkWidth: document.getElementById('sinkWidth') as HTMLInputElement, sinkHeight: document.getElementById('sinkHeight') as HTMLInputElement,
    material: document.getElementById('material') as HTMLSelectElement, finish: document.getElementById('finish') as HTMLSelectElement,
    isinkLength: document.getElementById('isinkLength') as HTMLInputElement, isinkWidth: document.getElementById('isinkWidth') as HTMLInputElement, isinkHeight: document.getElementById('isinkHeight') as HTMLInputElement,
    imaterial: document.getElementById('imaterial') as HTMLSelectElement, ifinish: document.getElementById('ifinish') as HTMLSelectElement, complexity: document.getElementById('complexity') as HTMLSelectElement,
    modalWallA: document.getElementById('modalWallA') as HTMLInputElement, modalWallB: document.getElementById('modalWallB') as HTMLInputElement, modalHypotenuseC: document.getElementById('modalHypotenuseC') as HTMLInputElement, modalArmWidth: document.getElementById('modalArmWidth') as HTMLInputElement,
    bowlConfig: document.getElementById('bowlConfig') as HTMLSelectElement, aprons: document.getElementById('aprons') as HTMLSelectElement, ledges: document.getElementById('ledges') as HTMLSelectElement, drainboards: document.getElementById('drainboards') as HTMLSelectElement,
    faucetDeck: document.getElementById('faucetDeck') as HTMLInputElement, edgeProfile: document.getElementById('edgeProfile') as HTMLInputElement, radiusCorner: document.getElementById('radiusCorner') as HTMLInputElement, faucetHole: document.getElementById('faucetHole') as HTMLInputElement, drainHole: document.getElementById('drainHole') as HTMLInputElement,
    backsplashLength: document.getElementById('backsplashLength') as HTMLInputElement, backsplashWidth: document.getElementById('backsplashWidth') as HTMLInputElement, backsplashMaterial: document.getElementById('backsplashMaterial') as HTMLSelectElement, backsplashEdgeProfile: document.getElementById('backsplashEdgeProfile') as HTMLInputElement,
    shipping: document.getElementById('shipping') as HTMLSelectElement, tax: document.getElementById('tax') as HTMLInputElement,
    crmData: document.getElementById('crm-data-input') as HTMLTextAreaElement,
    // PDF Info
    pdfQuoteNumber: document.getElementById('pdf-quote-number') as HTMLInputElement,
    pdfCustomerName: document.getElementById('pdf-customer-name') as HTMLInputElement,
    pdfBillTo: document.getElementById('pdf-bill-to') as HTMLTextAreaElement,
    pdfCustomerPhone: document.getElementById('pdf-customer-phone') as HTMLInputElement,
    pdfCustomerEmail: document.getElementById('pdf-customer-email') as HTMLInputElement,
    pdfAmountPaid: document.getElementById('pdf-amount-paid') as HTMLInputElement,
    pdfNotes: document.getElementById('pdf-notes') as HTMLTextAreaElement,
    // Email Helper
    templateSelect: document.getElementById('template-select') as HTMLSelectElement,
    emailEditor: document.getElementById('email-editor') as HTMLDivElement,
    modalCustomerName: document.getElementById('modal-customer-name') as HTMLInputElement,
    modalQuoteNumber: document.getElementById('modal-quote-number') as HTMLInputElement,
    modalBalanceDue: document.getElementById('modal-balance-due') as HTMLInputElement,
    modalCustomerAddress: document.getElementById('modal-customer-address') as HTMLTextAreaElement,
    modalTemplateName: document.getElementById('modal-template-name') as HTMLInputElement,
    attachmentInput: document.getElementById('attachment-input') as HTMLInputElement,
    passcodeInput: document.getElementById('passcode-input') as HTMLInputElement,
    // AI Export Modal
    aiShipping: document.getElementById('ai-shipping') as HTMLSelectElement,
    aiTax: document.getElementById('ai-tax') as HTMLInputElement,
};
const labels = {
    copperOption: document.getElementById('copper-option') as HTMLOptionElement, brassOption: document.getElementById('brass-option') as HTMLOptionElement,
    icopperOption: document.getElementById('icopper-option') as HTMLOptionElement, ibrassOption: document.getElementById('ibrass-option') as HTMLOptionElement,
    faucetDeck: document.getElementById('faucetDeck-label') as HTMLSpanElement, edgeProfile: document.getElementById('edgeProfile-label') as HTMLSpanElement, radiusCorner: document.getElementById('radiusCorner-label') as HTMLSpanElement, faucetHole: document.getElementById('faucetHole-label') as HTMLSpanElement, drainHole: document.getElementById('drainHole-label') as HTMLSpanElement,
    radiusCornerParent: document.getElementById('radiusCorner-label-parent') as HTMLLabelElement,
    zipLoader: document.getElementById('zip-loader') as HTMLParagraphElement,
    attachmentName: document.getElementById('attachment-name') as HTMLSpanElement,
    passcodeError: document.getElementById('passcode-error') as HTMLParagraphElement,
};
const containers = {
    // Quote Builder
    sink: document.getElementById('sink-calculator-container') as HTMLDivElement,
    irregular: document.getElementById('irregular-sink-calculator-container') as HTMLDivElement,
    backsplash: document.getElementById('backsplash-calculator-container') as HTMLDivElement,
    aiParser: document.getElementById('ai-parser-container') as HTMLDivElement,
    aiLoaderOverlay: document.getElementById('ai-loader-overlay') as HTMLDivElement,
    sinkAddons: document.getElementById('sink-addons-container') as HTMLDivElement,
    cornerCalcButton: document.getElementById('corner-calc-button-container') as HTMLDivElement,
    aiGeneratedQuotesList: document.getElementById('ai-generated-quotes-list') as HTMLDivElement,
    // Email Helper
    customerNameField: document.getElementById('customer-name-field') as HTMLDivElement,
    quoteNumberField: document.getElementById('quote-number-field') as HTMLDivElement,
    balanceDueField: document.getElementById('balance-due-field') as HTMLDivElement,
    customerAddressField: document.getElementById('customer-address-field') as HTMLDivElement,
    attachment: document.getElementById('attachment-container') as HTMLDivElement,
    attachmentDisplay: document.getElementById('attachment-display') as HTMLDivElement,
    attachmentInput: document.getElementById('attachment-input-container') as HTMLDivElement,
};
const quoteSummary = {
    list: document.getElementById('quote-items-list') as HTMLDivElement,
    masterTotalSection: document.getElementById('master-total-section') as HTMLDivElement,
    masterSubtotal: document.getElementById('master-subtotal') as HTMLSpanElement,
    masterShipping: document.getElementById('master-shipping') as HTMLSpanElement,
    masterTax: document.getElementById('master-tax') as HTMLSpanElement,
    masterGrandTotal: document.getElementById('master-grand-total') as HTMLSpanElement,
    itemBreakdownDetails: document.getElementById('item-breakdown-details') as HTMLDivElement,
    itemBreakdownTitle: document.getElementById('item-breakdown-title') as HTMLHeadingElement,
    itemBreakdownSection: document.getElementById('item-breakdown-section') as HTMLDivElement
};
const buttons = {
    // Navigation
    openQuoteBuilder: document.getElementById('open-quote-builder-btn') as HTMLDivElement,
    openEmailHelper: document.getElementById('open-email-helper-btn') as HTMLDivElement,
    qbBackToDashboard: document.getElementById('qb-back-to-dashboard') as HTMLButtonElement,
    ehBackToDashboard: document.getElementById('eh-back-to-dashboard') as HTMLButtonElement,
    // Quote Builder
    tabSink: document.getElementById('tab-sink') as HTMLButtonElement,
    tabIrregular: document.getElementById('tab-irregular') as HTMLButtonElement,
    tabBacksplash: document.getElementById('tab-backsplash') as HTMLButtonElement,
    tabAiParser: document.getElementById('tab-ai-parser') as HTMLButtonElement,
    addToQuote: document.getElementById('add-item-to-quote-btn') as HTMLButtonElement,
    startNewQuote: document.getElementById('start-new-quote-btn') as HTMLButtonElement,
    exportPdf: document.getElementById('export-pdf-btn') as HTMLButtonElement,
    guide: document.getElementById('guide-btn') as HTMLButtonElement,
    guideModal: document.getElementById('guide-modal') as HTMLDivElement,
    guideModalClose: document.getElementById('modal-close-btn') as HTMLButtonElement,
    openCornerCalc: document.getElementById('open-corner-calc-btn') as HTMLButtonElement,
    cornerCalcModal: document.getElementById('corner-calc-modal') as HTMLDivElement,
    cornerModalClose: document.getElementById('corner-modal-close-btn') as HTMLButtonElement,
    applyDimensions: document.getElementById('apply-dimensions-btn') as HTMLButtonElement,
    analyzeLeads: document.getElementById('analyze-leads-btn') as HTMLButtonElement,
    aiResultsModal: document.getElementById('ai-results-modal') as HTMLDivElement,
    aiResultsModalContent: document.getElementById('ai-results-modal-content') as HTMLDivElement,
    aiModalXClose: document.getElementById('ai-modal-x-close-btn') as HTMLButtonElement,
    modalGenerateQuotes: document.getElementById('modal-generate-quotes-btn') as HTMLButtonElement,
    copyFollowUps: document.getElementById('copy-follow-ups-btn') as HTMLButtonElement,
    copyConfirmation: document.getElementById('copy-confirmation') as HTMLParagraphElement,
    aiExportModal: document.getElementById('ai-export-modal') as HTMLDivElement,
    aiExportModalClose: document.getElementById('ai-export-modal-close-btn') as HTMLButtonElement,
    doneAiExport: document.getElementById('done-ai-export-btn') as HTMLButtonElement,
    aiExportAllZip: document.getElementById('ai-export-all-zip-btn') as HTMLButtonElement,
    // Email Helper
    newTemplate: document.getElementById('new-template-btn') as HTMLButtonElement,
    saveTemplate: document.getElementById('save-template-btn') as HTMLButtonElement,
    deleteTemplate: document.getElementById('delete-template-btn') as HTMLButtonElement,
    copyEmail: document.getElementById('copy-email-btn') as HTMLButtonElement,
    emailCopyConfirmation: document.getElementById('email-copy-confirmation') as HTMLParagraphElement,
    templateVarsModal: document.getElementById('template-vars-modal') as HTMLDivElement,
    applyVars: document.getElementById('apply-vars-btn') as HTMLButtonElement,
    cancelVars: document.getElementById('cancel-vars-btn') as HTMLButtonElement,
    saveTemplateModal: document.getElementById('save-template-modal') as HTMLDivElement,
    saveModalTitle: document.getElementById('save-modal-title') as HTMLHeadingElement,
    confirmSaveTemplate: document.getElementById('confirm-save-template-btn') as HTMLButtonElement,
    cancelSaveTemplate: document.getElementById('cancel-save-template-btn') as HTMLButtonElement,
    editTemplate: document.getElementById('edit-template-btn') as HTMLButtonElement,
    cancelEdit: document.getElementById('cancel-edit-btn') as HTMLButtonElement,
    removeAttachment: document.getElementById('remove-attachment-btn') as HTMLButtonElement,
    // Delete Confirmation Modal
    deleteConfirmModal: document.getElementById('delete-confirm-modal') as HTMLDivElement,
    deleteTemplateNameSpan: document.getElementById('delete-template-name') as HTMLSpanElement,
    confirmDeleteBtn: document.getElementById('confirm-delete-btn') as HTMLButtonElement,
    cancelDeleteBtn: document.getElementById('cancel-delete-btn') as HTMLButtonElement,
    // Passcode Modal
    passcodeModal: document.getElementById('passcode-modal') as HTMLDivElement,
    confirmPasscodeBtn: document.getElementById('confirm-passcode-btn') as HTMLButtonElement,
    cancelPasscodeBtn: document.getElementById('cancel-passcode-btn') as HTMLButtonElement,
};

// --- APP STATE ---
type AppView = 'dashboard' | 'quote-builder' | 'email-helper';
type QuoteItem = {
    mainDescription: string;
    subItems: string[];
    price: number;
};
type EmailTemplate = {
    id: string;
    name: string;
    content: string;
    attachment?: {
        name: string;
        type: string;
        data: string; // base64
    }
};
type AiGeneratedQuote = {
    leadData: any;
    quoteItem: QuoteItem;
};
type PdfOptions = {
    items: QuoteItem[];
    quoteNumber?: string;
    customerName?: string;
    customerAddress?: string;
    customerPhone?: string;
    customerEmail?: string;
    amountPaid?: number;
    notes?: string;
    subtotal?: number;
    shippingCost?: number;
    totalTax?: number;
    grandTotal?: number;
    outputType: 'save' | 'blob';
};


let masterQuoteItems: QuoteItem[] = [];
let aiGeneratedQuotes: AiGeneratedQuote[] = [];
let currentItemType: 'sink' | 'irregular' | 'backsplash' | 'ai-parser' = 'sink';
let hypotenuseLastEdited: string | null = null;
let parsedLeads: { quoteReadyLeads: any[], followUpLeads: any[] } | null = null;
let emailTemplates: EmailTemplate[] = [];
let currentAttachment: EmailTemplate['attachment'] | null | undefined = null;

// --- UTILITY FUNCTIONS ---
function formatAsCurrency(amount: number) { return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function createSummaryLine(label: string, value: number, isSubtotal = false) {
    const valueClass = isSubtotal ? 'font-semibold text-gray-800' : 'text-gray-600';
    return `<div class="summary-line"><span>${label}</span><span class="${valueClass}">${formatAsCurrency(value)}</span></div>`;
}
function showToast(element: HTMLElement, message: string) {
    element.textContent = message;
    element.classList.remove('opacity-0');
    setTimeout(() => {
        element.classList.add('opacity-0');
    }, 3000);
}
function dataURLtoBlob(dataurl: string) {
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
}


// --- NAVIGATION ---
function navigateTo(view: AppView) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[view].classList.remove('hidden');
    // Hide the floating guide button if not in quote builder
    buttons.guide.classList.toggle('hidden', view !== 'quote-builder');
}

// --- EMAIL HELPER ---
function renderAttachmentUI() {
    containers.attachmentDisplay.classList.add('hidden');
    containers.attachmentInput.classList.add('hidden');

    const isEditing = inputs.emailEditor.contentEditable === 'true';

    if (currentAttachment) {
        labels.attachmentName.textContent = currentAttachment.name;
        containers.attachmentDisplay.classList.remove('hidden');
        buttons.removeAttachment.disabled = !isEditing;
        buttons.removeAttachment.classList.toggle('cursor-not-allowed', !isEditing);
        buttons.removeAttachment.classList.toggle('opacity-50', !isEditing);
    } else if (isEditing) {
        containers.attachmentInput.classList.remove('hidden');
        inputs.attachmentInput.value = '';
    }
}

function setEmailEditorMode(isEditing: boolean) {
    inputs.emailEditor.contentEditable = String(isEditing);
    inputs.emailEditor.classList.toggle('editing', isEditing);

    const isTemplateSelected = !!inputs.templateSelect.value;
    
    containers.attachment.classList.toggle('hidden', !isTemplateSelected && !isEditing);

    buttons.saveTemplate.classList.toggle('hidden', !isEditing);
    buttons.cancelEdit.classList.toggle('hidden', !isEditing);
    buttons.editTemplate.classList.toggle('hidden', isEditing || !isTemplateSelected);
    buttons.deleteTemplate.classList.toggle('hidden', !isEditing || !isTemplateSelected);
    buttons.copyEmail.classList.toggle('hidden', isEditing);

    inputs.templateSelect.disabled = isEditing;
    buttons.newTemplate.disabled = isEditing;
    
    renderAttachmentUI();
}

function loadTemplates() {
    const storedTemplates = localStorage.getItem('emailTemplates');
    emailTemplates = storedTemplates ? JSON.parse(storedTemplates) : [];
    renderTemplateSelector();
    setEmailEditorMode(false);
}

function saveTemplates() {
    localStorage.setItem('emailTemplates', JSON.stringify(emailTemplates));
}

function renderTemplateSelector() {
    const currentVal = inputs.templateSelect.value;
    inputs.templateSelect.innerHTML = '<option value="">Select a template...</option>';
    emailTemplates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        inputs.templateSelect.appendChild(option);
    });
    // Only re-select if the option still exists
    if (inputs.templateSelect.querySelector(`option[value="${currentVal}"]`)) {
        inputs.templateSelect.value = currentVal;
    }
}

function handleNewTemplate() {
    inputs.templateSelect.value = '';
    inputs.emailEditor.innerHTML = '';
    currentAttachment = null;
    setEmailEditorMode(true);
    inputs.emailEditor.focus();
}

function handleSaveTemplate() {
    const selectedId = inputs.templateSelect.value;
    const template = emailTemplates.find(t => t.id === selectedId);

    if (template && inputs.emailEditor.contentEditable === 'true') {
        // Editing an existing template
        buttons.saveModalTitle.textContent = 'Update Template';
        inputs.modalTemplateName.value = template.name;
    } else {
        // Saving a new template
        buttons.saveModalTitle.textContent = 'Save New Template';
        inputs.modalTemplateName.value = '';
    }
    buttons.saveTemplateModal.classList.add('active');
    inputs.modalTemplateName.focus();
}

function handleConfirmSave() {
    const templateName = inputs.modalTemplateName.value.trim();
    if (!templateName) {
        alert("Please enter a template name.");
        return;
    }

    const selectedId = inputs.templateSelect.value;
    const content = inputs.emailEditor.innerHTML;
    const existingTemplateById = emailTemplates.find(t => t.id === selectedId);
    
    // Check if another template with the new name already exists (and it's not the one we're editing)
    const duplicateNameTemplate = emailTemplates.find(t => t.name.toLowerCase() === templateName.toLowerCase() && t.id !== selectedId);
    if (duplicateNameTemplate) {
        alert(`A template named "${templateName}" already exists. Please choose a different name.`);
        return;
    }

    let savedTemplateId = selectedId;
    const templateData = {
        name: templateName,
        content: content,
        attachment: currentAttachment
    };

    if (existingTemplateById && inputs.templateSelect.value) {
        // Update existing template
        Object.assign(existingTemplateById, templateData);
    } else {
        // Create new template
        const newTemplate: EmailTemplate = {
            id: Date.now().toString(),
            ...templateData
        };
        emailTemplates.push(newTemplate);
        savedTemplateId = newTemplate.id;
    }

    saveTemplates();
    renderTemplateSelector();

    // Reselect the saved template
    inputs.templateSelect.value = savedTemplateId;
    
    buttons.saveTemplateModal.classList.remove('active');
    handleSelectTemplate(); // Re-load content in view mode
    showToast(buttons.emailCopyConfirmation, 'Template saved!');
}

function handleConfirmDelete() {
    const selectedId = inputs.templateSelect.value;
    if (!selectedId) return;

    emailTemplates = emailTemplates.filter(t => t.id !== selectedId);
    saveTemplates();
    
    buttons.deleteConfirmModal.classList.remove('active');
    
    inputs.templateSelect.value = '';
    renderTemplateSelector();
    handleSelectTemplate(); 
    
    showToast(buttons.emailCopyConfirmation, 'Template deleted.');
}

function handleDeleteTemplate() {
    const selectedId = inputs.templateSelect.value;
    const template = emailTemplates.find(t => t.id === selectedId);

    if (template) {
        buttons.deleteTemplateNameSpan.textContent = template.name;
        buttons.deleteConfirmModal.classList.add('active');
    }
}

function handleSelectTemplate() {
    const selectedId = inputs.templateSelect.value;
    const template = emailTemplates.find(t => t.id === selectedId);
    
    if (!template) {
        inputs.emailEditor.innerHTML = '';
        currentAttachment = null;
        setEmailEditorMode(false);
        return;
    };

    inputs.emailEditor.innerHTML = template.content;
    currentAttachment = template.attachment;
    setEmailEditorMode(false); 

    if (template.attachment) {
        buttons.copyEmail.textContent = 'Copy & Download';
    } else {
        buttons.copyEmail.textContent = 'Copy Email';
    }

    const needsName = template.content.includes("{{customerName}}");
    const needsQuoteNum = template.content.includes("{{quoteNumber}}");
    const needsBalanceDue = template.content.includes("{{balanceDue}}");
    const needsAddress = template.content.includes("{{customerAddress}}");

    if (needsName || needsQuoteNum || needsBalanceDue || needsAddress) {
        containers.customerNameField.classList.toggle('hidden', !needsName);
        containers.quoteNumberField.classList.toggle('hidden', !needsQuoteNum);
        containers.balanceDueField.classList.toggle('hidden', !needsBalanceDue);
        containers.customerAddressField.classList.toggle('hidden', !needsAddress);
        inputs.modalCustomerName.value = '';
        inputs.modalQuoteNumber.value = '';
        inputs.modalBalanceDue.value = '';
        inputs.modalCustomerAddress.value = '';
        buttons.templateVarsModal.classList.add('active');
    }
}

function handleApplyTemplateVars() {
    const name = inputs.modalCustomerName.value;
    const quoteNum = inputs.modalQuoteNumber.value;
    const balanceDue = inputs.modalBalanceDue.value;
    const address = inputs.modalCustomerAddress.value;
    let content = inputs.emailEditor.innerHTML;

    content = content.replace(/\{\{customerName\}\}/g, name || '');
    content = content.replace(/\{\{quoteNumber\}\}/g, quoteNum || '');
    content = content.replace(/\{\{balanceDue\}\}/g, balanceDue || '');
    content = content.replace(/\{\{customerAddress\}\}/g, address || '');

    inputs.emailEditor.innerHTML = content;
    buttons.templateVarsModal.classList.remove('active');
}

function handleCopyEmail() {
    const selectedId = inputs.templateSelect.value;
    const template = emailTemplates.find(t => t.id === selectedId);
    if (!template) return;

    const content = inputs.emailEditor.innerHTML;
    const blob = new Blob([content], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });

    navigator.clipboard.write([clipboardItem]).then(() => {
        if (template.attachment && template.attachment.data) {
            const attachmentBlob = dataURLtoBlob(template.attachment.data);
            if(attachmentBlob) {
                const url = URL.createObjectURL(attachmentBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = template.attachment.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            showToast(buttons.emailCopyConfirmation, 'Email copied & attachment downloaded!');
        } else {
            showToast(buttons.emailCopyConfirmation, 'Email content copied!');
        }
    }).catch(err => {
        console.error('Failed to copy email content:', err);
        alert('Failed to copy email.');
    });
}

function handleCancelEdit() {
    handleSelectTemplate();
}

function handleAttachmentChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
        currentAttachment = null;
        renderAttachmentUI();
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentAttachment = {
            name: file.name,
            type: file.type,
            data: e.target?.result as string
        };
        renderAttachmentUI();
    };
    reader.readAsDataURL(file);
}

function handleRemoveAttachment() {
    currentAttachment = null;
    renderAttachmentUI();
}

function handleEditRequest() {
    inputs.passcodeInput.value = '';
    labels.passcodeError.classList.add('hidden');
    buttons.passcodeModal.classList.add('active');
    inputs.passcodeInput.focus();
}

function handleConfirmPasscode() {
    if (inputs.passcodeInput.value === EDIT_PASSCODE) {
        buttons.passcodeModal.classList.remove('active');
        setEmailEditorMode(true);
    } else {
        labels.passcodeError.classList.remove('hidden');
        inputs.passcodeInput.value = '';
        inputs.passcodeInput.focus();
    }
}

// --- QUOTE BUILDER: UI & State ---
function switchTab(type: 'sink' | 'irregular' | 'backsplash' | 'ai-parser') {
    currentItemType = type;
    Object.values(buttons).filter(b => b && b.id && b.id.startsWith('tab-')).forEach(b => b.classList.remove('active'));
    Object.values(containers).forEach(c => c && c.classList.add('hidden'));

    const activeTabButton = document.getElementById(`tab-${type}`);
    if (activeTabButton) activeTabButton.classList.add('active');

    const containerKey = type === 'ai-parser' ? 'aiParser' : type;
    if (containers[containerKey as keyof typeof containers]) containers[containerKey as keyof typeof containers].classList.remove('hidden');

    containers.sinkAddons.classList.toggle('hidden', type === 'backsplash' || type === 'ai-parser');
    quoteSummary.itemBreakdownSection.classList.toggle('hidden', type === 'ai-parser');
    if (type !== 'ai-parser') {
        labels.radiusCornerParent.classList.toggle('hidden', type === 'irregular');
        const title = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        quoteSummary.itemBreakdownTitle.textContent = `${title} Breakdown`;
        calculateAndRenderCurrentItem();
    }
}

function updateFinishOptions(isIrregular = false) {
    const materialSelect = isIrregular ? inputs.imaterial : inputs.material;
    const finishSelect = isIrregular ? inputs.ifinish : inputs.finish;

    const selectedMaterial = materialSelect.value as 'stainless' | 'copper' | 'brass';
    const currentFinishValue = finishSelect.value;
    finishSelect.innerHTML = '';
    FINISH_OPTIONS[selectedMaterial].forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.text;
        finishSelect.appendChild(optionEl);
    });
    if (finishSelect.querySelector(`option[value="${currentFinishValue}"]`)) {
        finishSelect.value = currentFinishValue;
    }
}

function updateDynamicLabels(basePrice: number, materialSubtotal: number, sinkSubtotal: number, isIrregular = false) {
    const copperLabel = isIrregular ? labels.icopperOption : labels.copperOption;
    const brassLabel = isIrregular ? labels.ibrassOption : labels.brassOption;
    const materialSelect = isIrregular ? inputs.imaterial : inputs.material;
    const finishSelect = isIrregular ? inputs.ifinish : inputs.finish;

    copperLabel.textContent = `Copper (+${(PERCENTAGES.material.copper * 100).toFixed(1)}%) +${formatAsCurrency(basePrice * PERCENTAGES.material.copper)}`;
    brassLabel.textContent = `Brass (+${(PERCENTAGES.material.brass * 100).toFixed(1)}%) +${formatAsCurrency(basePrice * PERCENTAGES.material.brass)}`;

    const selectedMaterial = materialSelect.value as 'stainless' | 'copper' | 'brass';
    const finishOptions = finishSelect.options;
    for (let i = 0; i < finishOptions.length; i++) {
        const option = finishOptions[i];
        const finishValue = option.value as 'none' | 'prestige' | 'hammered';
        if (finishValue !== 'none') {
            const baseText = FINISH_OPTIONS[selectedMaterial][i].text;
            const percent = PERCENTAGES.finish[selectedMaterial][finishValue];
            const upcharge = materialSubtotal * percent;
            option.textContent = `${baseText} (+${(percent * 100).toFixed(1)}%) +${formatAsCurrency(upcharge)}`;
        }
    }

    const addonPercentSource = isIrregular ? { ...PERCENTAGES.addOns, ...PERCENTAGES.irregularAddOns } : PERCENTAGES.addOns;
    const checkboxLabels = ['faucetDeck', 'edgeProfile', 'radiusCorner', 'faucetHole', 'drainHole'] as const;
    checkboxLabels.forEach(addon => {
        if (labels[addon]) {
            const addOnUpcharge = sinkSubtotal * addonPercentSource[addon];
            const addonName = labels[addon].textContent?.split('(')[0].trim();
            const percent = `(+${(addonPercentSource[addon] * 100).toFixed(1)}%)`;
            labels[addon].innerHTML = `${addonName} ${percent} <span class="option-price">+${formatAsCurrency(addOnUpcharge)}</span>`;
        }
    })

    if (isIrregular) {
        const complexityOptions = inputs.complexity.options;
        for (let i = 0; i < complexityOptions.length; i++) {
            const option = complexityOptions[i];
            const complexityValue = option.value as keyof typeof PERCENTAGES.complexity;
            const baseText = COMPLEXITY_OPTIONS[i].text;
            if (complexityValue !== 'level_1') {
                const percent = PERCENTAGES.complexity[complexityValue];
                const upcharge = sinkSubtotal * percent;
                option.innerHTML = `${baseText} (+${(percent * 100).toFixed(1)}%) <span class="option-price">+${formatAsCurrency(upcharge)}</span>`;
            } else {
                option.textContent = baseText;
            }
        }
    }
}

function updateAddonAvailability() {
    const finishInput = currentItemType === 'irregular' ? inputs.ifinish : inputs.finish;
    const isTextured = finishInput.value === 'prestige';
    inputs.radiusCorner.disabled = isTextured;
    labels.radiusCornerParent.classList.toggle('disabled', isTextured);
    if (isTextured) {
        inputs.radiusCorner.checked = false;
    }

    const isComplexIrregular = currentItemType === 'irregular' && (inputs.complexity.value === 'level_2' || inputs.complexity.value === 'level_3');
    inputs.ledges.disabled = isComplexIrregular;
    inputs.drainboards.disabled = isComplexIrregular;
    if (isComplexIrregular) {
        inputs.ledges.value = '0';
        inputs.drainboards.value = '0';
    }

    if (currentItemType === 'irregular') {
        const currentMaterial = inputs.imaterial.value;
        const isHighComplexity = inputs.complexity.value === 'level_2' || inputs.complexity.value === 'level_3';

        Array.from(inputs.imaterial.options).forEach(opt => {
            if (opt.value === 'stainless') {
                opt.disabled = isHighComplexity;
                opt.hidden = isHighComplexity;
            }
        });

        if (isHighComplexity && currentMaterial === 'stainless') {
            inputs.imaterial.value = 'copper';
            inputs.imaterial.dispatchEvent(new Event('change'));
        }

        containers.cornerCalcButton.classList.toggle('hidden', inputs.complexity.value !== 'level_1');
    }
}

// --- QUOTE BUILDER: Calculations ---

function renderMasterQuote() {
    if (masterQuoteItems.length === 0) {
        quoteSummary.list.innerHTML = `<p class="text-gray-500 text-center py-4">No items added to the quote yet.</p>`;
        quoteSummary.masterTotalSection.classList.add('hidden');
        buttons.startNewQuote.classList.add('hidden');
        buttons.exportPdf.classList.add('hidden');
        return;
    }

    quoteSummary.list.innerHTML = masterQuoteItems.map((item, index) =>
        `<div class="summary-line"><span>${index + 1}. ${item.mainDescription}</span><span class="font-medium">${formatAsCurrency(item.price)}</span></div>`
    ).join('');

    const subtotal = masterQuoteItems.reduce((acc, item) => acc + item.price, 0);
    const shippingType = inputs.shipping.value as keyof typeof PERCENTAGES.shipping;
    const shippingPercentage = PERCENTAGES.shipping[shippingType] || 0;
    const shippingCost = subtotal * shippingPercentage;
    const totalBeforeTax = subtotal + shippingCost;
    
    const stateTax = inputs.tax.checked ? totalBeforeTax * PERCENTAGES.tax.state : 0;
    const countyTax = inputs.tax.checked ? totalBeforeTax * PERCENTAGES.tax.county : 0;
    const totalTax = stateTax + countyTax;
    const grandTotal = totalBeforeTax + totalTax;

    quoteSummary.masterSubtotal.textContent = formatAsCurrency(subtotal);
    quoteSummary.masterShipping.textContent = formatAsCurrency(shippingCost);
    quoteSummary.masterTax.textContent = formatAsCurrency(totalTax);
    quoteSummary.masterGrandTotal.textContent = formatAsCurrency(grandTotal);

    quoteSummary.masterTotalSection.classList.remove('hidden');
    buttons.startNewQuote.classList.remove('hidden');
    buttons.exportPdf.classList.remove('hidden');
}

function getSourceData(isIrregular: boolean, leadData: any | null) {
    if (leadData) {
        return {
            length: leadData.dimensions.length,
            width: leadData.dimensions.width,
            height: leadData.dimensions.height,
            material: leadData.material,
            finish: leadData.finish,
            complexity: leadData.complexity,
            bowlConfig: leadData.addOns.bowlConfig || "0",
            aprons: leadData.addOns.aprons || "0",
            ledges: leadData.addOns.ledges || "0",
            drainboards: leadData.addOns.drainboards || "0",
            faucetDeck: leadData.addOns.faucetDeck || false,
            edgeProfile: leadData.addOns.edgeProfile || false,
            radiusCorner: leadData.addOns.radiusCorner || false,
            faucetHole: leadData.addOns.faucetHole || false,
            drainHole: leadData.addOns.drainHole || false,
        };
    }
    return {
        length: parseFloat((isIrregular ? inputs.isinkLength : inputs.sinkLength).value),
        width: parseFloat((isIrregular ? inputs.isinkWidth : inputs.sinkWidth).value),
        height: parseFloat((isIrregular ? inputs.isinkHeight : inputs.sinkHeight).value),
        material: (isIrregular ? inputs.imaterial : inputs.material).value,
        finish: (isIrregular ? inputs.ifinish : inputs.finish).value,
        complexity: inputs.complexity.value,
        bowlConfig: inputs.bowlConfig.value,
        aprons: inputs.aprons.value,
        ledges: inputs.ledges.value,
        drainboards: inputs.drainboards.value,
        faucetDeck: inputs.faucetDeck.checked,
        edgeProfile: inputs.edgeProfile.checked,
        radiusCorner: inputs.radiusCorner.checked,
        faucetHole: inputs.faucetHole.checked,
        drainHole: inputs.drainHole.checked,
    };
}

function calculateSinkPrice(isIrregular = false, leadData: any = null): { breakdownHTML: string; total: number; mainDescription: string, subItems: string[] } {
    let breakdownHTML = '';
    let sinkTotal = 0;
    let subItems: string[] = [];

    const source = getSourceData(isIrregular, leadData);
    const materialInput = isIrregular ? inputs.imaterial : inputs.material;

    const basePrice = isIrregular ? BASE_IRREGULAR_SINK_PRICE : BASE_SINK_PRICE;
    const currentL = source.length || BASE_DIMENSIONS.length;
    const currentW = source.width || BASE_DIMENSIONS.width;
    const currentH = source.height || BASE_DIMENSIONS.height;

    let heightUpcharge = 0;
    if (currentH > BASE_DIMENSIONS.height) {
        if (currentH <= HEIGHT_TIER1_THRESHOLD) {
            heightUpcharge = (currentH - BASE_DIMENSIONS.height) * PRICE_PER_INCH.h_tier1;
        } else {
            const tier1Upcharge = (HEIGHT_TIER1_THRESHOLD - BASE_DIMENSIONS.height) * PRICE_PER_INCH.h_tier1;
            const tier2Upcharge = (currentH - HEIGHT_TIER1_THRESHOLD) * PRICE_PER_INCH.h_tier2;
            heightUpcharge = tier1Upcharge + tier2Upcharge;
        }
    }
    const sizeUpcharge = (Math.max(0, currentL - BASE_DIMENSIONS.length) * PRICE_PER_INCH.lw) + (Math.max(0, currentW - BASE_DIMENSIONS.width) * PRICE_PER_INCH.lw) + heightUpcharge;
    const priceAfterSize = basePrice + sizeUpcharge;
    sinkTotal += priceAfterSize;
    breakdownHTML += createSummaryLine(`Base Price (${currentL}"x${currentW}"x${currentH}")`, priceAfterSize);

    if (!leadData) { 
        if (isIrregular) updateAddonAvailability();
    }
    const selectedMaterial = source.material as 'stainless' | 'copper' | 'brass';
    let materialSubtotal = priceAfterSize;
    let materialText = leadData ? source.material.charAt(0).toUpperCase() + source.material.slice(1) : materialInput.options[materialInput.selectedIndex].text.split('(')[0].trim();
    if(materialText !== "Stainless Steel") subItems.push(`Luxury Metal Finish: ${materialText}`);

    if (selectedMaterial && selectedMaterial !== 'stainless') {
        const materialUpcharge = priceAfterSize * (PERCENTAGES.material[selectedMaterial] || 0);
        sinkTotal += materialUpcharge;
        materialSubtotal += materialUpcharge;
        breakdownHTML += createSummaryLine(`${materialText} Upgrade`, materialUpcharge);
    }
    
    const selectedFinish = source.finish as 'none' | 'prestige' | 'hammered';
    let sinkSubtotalForLabels = sinkTotal;
    if (selectedMaterial && selectedFinish && selectedFinish !== 'none') {
        const finishPercentage = PERCENTAGES.finish[selectedMaterial]?.[selectedFinish] || 0;
        if (finishPercentage > 0) {
            const finishUpcharge = sinkTotal * finishPercentage;
            const finishName = FINISH_OPTIONS[selectedMaterial].find(f => f.value === selectedFinish)?.text.split('(')[0].trim() || 'Finish';
            sinkTotal += finishUpcharge;
            sinkSubtotalForLabels += finishUpcharge;
            if (finishName) {
                breakdownHTML += createSummaryLine(`${finishName} Finish`, finishUpcharge);
                subItems.push(`Finish: ${finishName}`);
            }
        }
    }
    
    if(!leadData) {
      updateDynamicLabels(priceAfterSize, materialSubtotal, sinkSubtotalForLabels, isIrregular);
      if (!isIrregular) updateAddonAvailability();
    }

    const finalSinkSubtotal = sinkTotal;

    const dropdownAddonConfigs = [
        { key: 'bowlConfig', config: ADDON_DESCRIPTIONS.bowlConfig, label: 'Bowl Design' },
        { key: 'aprons', config: ADDON_DESCRIPTIONS.aprons, label: 'Aprons' },
        { key: 'ledges', config: ADDON_DESCRIPTIONS.ledges, label: 'Ledges' },
        { key: 'drainboards', config: ADDON_DESCRIPTIONS.drainboards, label: 'Drainboards' },
    ] as const;

    dropdownAddonConfigs.forEach(({key, config, label}) => {
        const value = source[key] as string;
        if (value && parseFloat(value) > 0) {
            const percent = parseFloat(value);
            const upcharge = finalSinkSubtotal * percent;
            sinkTotal += upcharge;
            const name = config[value as keyof typeof config];
            if (name) {
                breakdownHTML += createSummaryLine(name, upcharge);
                subItems.push(`${label}: ${name}`);
            }
        }
    });

    const addonPercentSource = isIrregular ? { ...PERCENTAGES.addOns, ...PERCENTAGES.irregularAddOns } : PERCENTAGES.addOns;
    const checkboxAddons = { faucetDeck: 'Integrated Faucet Deck', edgeProfile: 'Raised Edge Profile', radiusCorner: 'Radius Corner', faucetHole: 'Addtl. Faucet Hole', drainHole: 'Addtl. Drain Hole' } as const;

    Object.keys(checkboxAddons).forEach(key => {
        const addonKey = key as keyof typeof checkboxAddons;
        if (isIrregular && addonKey === 'radiusCorner') return;
        if (source[addonKey]) {
            const upcharge = finalSinkSubtotal * (addonPercentSource[addonKey] || 0);
            sinkTotal += upcharge;
            breakdownHTML += createSummaryLine(checkboxAddons[addonKey], upcharge);
            subItems.push(checkboxAddons[addonKey]);
        }
    });
    
    if (isIrregular) {
        const complexityLevel = source.complexity as keyof typeof PERCENTAGES.complexity;
        if (complexityLevel) {
            subItems.push(`Complexity: ${COMPLEXITY_OPTIONS.find(c => c.value === complexityLevel)?.text || `Level ${complexityLevel.split('_')[1]}`}`);
            const complexityUpchargePercent = PERCENTAGES.complexity[complexityLevel] || 0;
            if (complexityUpchargePercent > 0) {
                const complexityUpcharge = sinkTotal * complexityUpchargePercent;
                sinkTotal += complexityUpcharge;
                breakdownHTML += createSummaryLine(`Complexity ${complexityLevel.split('_')[1]} Upcharge`, complexityUpcharge);
            }
        }
    }
    
    let mainDescription = `${isIrregular ? 'Irregular ' : ''}${materialText} Sink - ${currentL}"x${currentW}"x${currentH}"`;
    return { breakdownHTML, total: sinkTotal, mainDescription, subItems };
}

function calculateBacksplashPrice(leadData: any = null): { breakdownHTML: string; total: number; mainDescription: string, subItems: string[] } {
    const length = leadData ? leadData.dimensions.length : parseFloat(inputs.backsplashLength.value) || 0;
    const width = leadData ? leadData.dimensions.width : parseFloat(inputs.backsplashWidth.value) || 0;
    let edgeProfile = leadData ? (leadData.backsplashEdgeProfile || 0) : parseFloat(inputs.backsplashEdgeProfile.value) || 0;
    let subItems: string[] = [];

    if (!length && !width) {
        return { breakdownHTML: '<p class="text-gray-500 text-center py-4">Enter dimensions to price a backsplash.</p>', total: 0, mainDescription: '', subItems: [] };
    }

    if (edgeProfile > 0 && edgeProfile < 0.375 && !leadData) {
        edgeProfile = 0.375;
        inputs.backsplashEdgeProfile.value = '0.375';
    }

    const materialKey = (leadData ? leadData.material : inputs.backsplashMaterial.value) as keyof typeof BACKSPLASH_CONFIG.materials;
    const materialConfig = BACKSPLASH_CONFIG.materials[materialKey];
    const basePrice = materialConfig.basePrice;

    const requiredLength = length + (2 * edgeProfile);
    const requiredWidth = width + (2 * edgeProfile);

    let pieces = [{ l: length, w: width }];
    let splitMessage = '';

    const lengthExceeded = requiredLength > BACKSPLASH_CONFIG.maxLength;
    const widthExceeded = requiredWidth > BACKSPLASH_CONFIG.maxWidth;

    if (lengthExceeded && widthExceeded) {
        const numPiecesL = Math.ceil(requiredLength / BACKSPLASH_CONFIG.maxLength);
        const numPiecesW = Math.ceil(requiredWidth / BACKSPLASH_CONFIG.maxWidth);
        const newL = length / numPiecesL;
        const newW = width / numPiecesW;
        pieces = [];
        for (let i = 0; i < numPiecesL * numPiecesW; i++) { pieces.push({ l: newL, w: newW }); }
        splitMessage = `Material needed (${requiredLength.toFixed(1)}"x${requiredWidth.toFixed(1)}") exceeds max size. Job split into ${pieces.length} pieces.`;
    } else if (lengthExceeded) {
        const numPieces = Math.ceil(requiredLength / BACKSPLASH_CONFIG.maxLength);
        const newL = length / numPieces;
        pieces = [];
        for(let i = 0; i < numPieces; i++) { pieces.push({ l: newL, w: width }); }
        splitMessage = `Material needed (${requiredLength.toFixed(1)}") exceeds max length. Job split into ${numPieces} pieces.`;
    } else if (widthExceeded) {
        const numPieces = Math.ceil(requiredWidth / BACKSPLASH_CONFIG.maxWidth);
        const newW = width / numPieces;
        pieces = [];
        for(let i = 0; i < numPieces; i++) { pieces.push({ l: length, w: newW }); }
        splitMessage = `Material needed (${requiredWidth.toFixed(1)}") exceeds max width. Job split into ${numPieces} pieces.`;
    }

    let total = 0;
    let breakdownHTML = splitMessage ? `<div class="split-notification">${splitMessage}</div>` : '';

    pieces.forEach((piece, index) => {
        const sumOfDimensions = piece.l + piece.w;
        let piecePrice = basePrice + (sumOfDimensions * BACKSPLASH_CONFIG.pricePerInch);
        
        let edgeUpcharge = 0;
        if (edgeProfile > 0) {
            const areaSqFt = (piece.l * piece.w) / 144;
            edgeUpcharge = areaSqFt * BACKSPLASH_CONFIG.edgeProfilePricePerSqFt;
        }
        
        let hammeredUpcharge = 0;
        if (materialKey === 'luxe_hammered' && 'upcharge' in materialConfig) {
            hammeredUpcharge = piecePrice * materialConfig.upcharge;
        }

        const totalPiecePrice = piecePrice + edgeUpcharge + hammeredUpcharge;
        total += totalPiecePrice;

        breakdownHTML += createSummaryLine(`Piece ${index + 1} (${piece.l.toFixed(1)}"x${piece.w.toFixed(1)}")`, piecePrice);
        if (hammeredUpcharge > 0) {
            breakdownHTML += createSummaryLine(`&nbsp;&nbsp;↳ Hammered Upcharge`, hammeredUpcharge);
        }
        if (edgeUpcharge > 0) {
            breakdownHTML += createSummaryLine(`&nbsp;&nbsp;↳ Edge Profile Add-on`, edgeUpcharge);
        }
    });
    
    const materialTextOption = leadData ? null : inputs.backsplashMaterial.options[inputs.backsplashMaterial.selectedIndex];
    const materialText = leadData ? leadData.material.replace(/_/g, ' ') : materialTextOption.text.split('(')[0].trim();
    let mainDescription = `${length}"x${width}" ${materialText} Backsplash`;
    if (edgeProfile > 0) mainDescription += ` w/ ${edgeProfile}" Edge`;
    if (pieces.length > 1) mainDescription += ` (${pieces.length} pcs)`;

    subItems.push(`Dimensions: ${length}" x ${width}"`);
    subItems.push(`Material: ${materialText}`);
    if (edgeProfile > 0) subItems.push(`Edge Profile: ${edgeProfile}"`);
    if (pieces.length > 1) subItems.push(`Pieces: ${pieces.length}`);

    return { breakdownHTML, total, mainDescription, subItems };
}

function calculateAndRenderCurrentItem() {
    let result: { breakdownHTML: string; total: number; mainDescription: string, subItems: string[] };
    const breakdownContainer = quoteSummary.itemBreakdownDetails;
    const addToQuoteBtn = buttons.addToQuote;

    switch (currentItemType) {
        case 'sink': result = calculateSinkPrice(false); break;
        case 'irregular': result = calculateSinkPrice(true); break;
        case 'backsplash': result = calculateBacksplashPrice(); break;
        default: breakdownContainer.innerHTML = ''; return;
    }

    if (result && result.breakdownHTML) {
        breakdownContainer.innerHTML = result.breakdownHTML + createSummaryLine('Total', result.total, true);
    }
    addToQuoteBtn.disabled = !result || result.total <= 0;
    if (addToQuoteBtn.dataset) {
        addToQuoteBtn.dataset.price = result.total.toString();
        addToQuoteBtn.dataset.mainDescription = result.mainDescription;
        addToQuoteBtn.dataset.subItems = JSON.stringify(result.subItems);
    }
}

// --- QUOTE BUILDER: PDF Generation ---
async function generatePDF(options: Partial<PdfOptions>): Promise<Blob | void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const themeColor = '#0E2D5B';

    const config = {
        items: [],
        quoteNumber: 'N/A',
        customerName: 'N/A',
        customerAddress: '',
        customerPhone: '',
        customerEmail: '',
        amountPaid: 0,
        notes: '',
        subtotal: 0,
        shippingCost: 0,
        totalTax: 0,
        grandTotal: 0,
        outputType: 'save' as 'save' | 'blob',
        ...options
    };

    const orderDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // --- Build PDF ---
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(themeColor);
    doc.text('Official Quote', margin, 20);
    doc.setTextColor('#000000');
    doc.setFont('helvetica', 'normal');
    doc.text(`#${config.quoteNumber}`, margin, 26);

    doc.setFont('helvetica', 'bold');
    doc.text('Client', margin, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(config.customerName, margin, 40);

    doc.setFont('helvetica', 'bold');
    doc.text('Address', margin, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(config.customerAddress, margin, 52, { maxWidth: 60 });
    
    let lastY = 52 + (doc.getTextDimensions(config.customerAddress, { maxWidth: 60 }).h);

    doc.setFont('helvetica', 'bold');
    doc.text('Phone', margin, lastY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(config.customerPhone, margin, lastY + 12);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Email', margin, lastY + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(config.customerEmail, margin, lastY + 24);


    // Center Logo (Placeholder)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('HAVENS', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(8);
    doc.text('LUXURY METALS', pageWidth / 2, 24, { align: 'center' });
    doc.setFontSize(7);
    doc.rect(pageWidth/2 - 15, 28, 30, 10);
    doc.text('AMERICAN\nHANDCRAFTED', pageWidth / 2, 32, { align: 'center' });

    // Right Column
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(themeColor);
    doc.text('Quote Date', pageWidth - margin, 20, { align: 'right' });
    doc.setTextColor('#000000');
    doc.setFont('helvetica', 'normal');
    doc.text(orderDate, pageWidth - margin, 26, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('Havens Luxury Metals', pageWidth - margin, 34, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('707 W Park Ave', pageWidth - margin, 40, { align: 'right' });
    doc.text('Edgewater, FL 32132', pageWidth - margin, 46, { align: 'right' });
    doc.text('United States', pageWidth - margin, 52, { align: 'right' });

    // Table
    const tableBody: any[] = [];
    config.items.forEach(item => {
        tableBody.push([
            { content: item.mainDescription, styles: { fontStyle: 'bold' } },
            { content: 'x 1', styles: { halign: 'center' } },
            { content: formatAsCurrency(item.price), styles: { halign: 'right' } },
            { content: formatAsCurrency(item.price), styles: { halign: 'right' } }
        ]);
        if (item.subItems && item.subItems.length > 0) {
            item.subItems.forEach(sub => {
                tableBody.push([
                    { content: `  ${sub}`, colSpan: 4, styles: { textColor: '#4b5563', fontStyle: 'italic' } },
                ]);
            });
        }
    });

    let finalY = 0;

    doc.autoTable({
        startY: Math.max(80, lastY + 30),
        head: [['Item(s)', 'Qty', 'Price', 'Total']],
        body: tableBody,
        theme: 'plain',
        headStyles: {
            fontStyle: 'bold',
            textColor: themeColor,
            lineColor: themeColor,
            lineWidth: { top: 0, bottom: 0.5 },
        },
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 2,
        },
        columnStyles: {
            0: { cellWidth: 105 },
            1: { cellWidth: 15, halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        },
        didDrawPage: (data: any) => {
            finalY = data.cursor.y;
        },
        didParseCell: function(data: any) {
            if (data.row.raw[0].styles && data.row.raw[0].styles.fontStyle === 'bold') {
                data.row.height += 2; 
            }
        }
    });
    
    // Notes and Totals
    const totalsStartY = finalY + 10;
    const totalsX = pageWidth - margin;
    const totalsLabelX = totalsX - 35;
    
    let currentY = totalsStartY;

    if (config.notes) {
         doc.setFont('helvetica', 'bold');
         doc.setFontSize(10);
         doc.text('Notes', margin, currentY);
         doc.setFont('helvetica', 'normal');
         doc.text(config.notes, margin, currentY + 6, { maxWidth: 80 });
         currentY += doc.getTextDimensions(config.notes, {maxWidth: 80}).h + 8;
    }

    let totalsY = totalsStartY;
    
    const drawTotalLine = (label: string, value: number, isBold=false) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(label, totalsLabelX, totalsY);
        doc.text(formatAsCurrency(value), totalsX, totalsY, { align: 'right'});
        totalsY += 6;
    };
    
    drawTotalLine('Subtotal', config.subtotal ?? 0);
    drawTotalLine('Shipping', config.shippingCost ?? 0);
    if((config.totalTax ?? 0) > 0) drawTotalLine('Sales Tax', config.totalTax ?? 0);

    doc.setDrawColor('#000000');
    doc.setLineWidth(0.3);
    doc.line(totalsLabelX - 5, totalsY, totalsX, totalsY);
    totalsY += 5;

    drawTotalLine('Total', config.grandTotal ?? 0, true);
    if((config.amountPaid ?? 0) > 0) drawTotalLine('Paid', -(config.amountPaid ?? 0));

    // Save or Return
    if (config.outputType === 'blob') {
        return doc.output('blob');
    } else {
        doc.save(`Quote-${config.quoteNumber}.pdf`);
    }
}


// --- QUOTE BUILDER: AI Assistant ---

const leadSchema = {
    type: Type.OBJECT,
    properties: {
        quoteReadyLeads: {
            type: Type.ARRAY,
            description: "A list of leads with all necessary information to generate a quote.",
            items: {
                type: Type.OBJECT,
                properties: {
                    customerName: { type: Type.STRING, description: "The full name of the customer." },
                    productType: { type: Type.STRING, description: "Type of product, e.g., 'sink', 'irregular_sink', 'backsplash'." },
                    dimensions: {
                        type: Type.OBJECT,
                        properties: {
                            length: { type: Type.NUMBER, description: "Length in inches." },
                            width: { type: Type.NUMBER, description: "Width in inches." },
                            height: { type: Type.NUMBER, description: "Height in inches (for sinks only)." }
                        }
                    },
                    material: { type: Type.STRING, description: "Material, e.g., 'stainless', 'copper', 'brass'." },
                    finish: { type: Type.STRING, description: "Finish, e.g., 'none', 'prestige', 'hammered'." },
                    complexity: { type: Type.STRING, description: "Complexity for irregular sinks, e.g., 'level_1', 'level_2', 'level_3'." },
                    addOns: {
                        type: Type.OBJECT,
                        properties: {
                            bowlConfig: { type: Type.STRING, description: "e.g. '0.3879' for double bowl"},
                            aprons: { type: Type.STRING, description: "e.g. '0.3879' for 1 apron" },
                            ledges: { type: Type.STRING, description: "e.g. '0.1293' for 1 ledge" },
                            drainboards: { type: Type.STRING, description: "e.g. '0.3879' for 1 drainboard" },
                            faucetDeck: { type: Type.BOOLEAN },
                            edgeProfile: { type: Type.BOOLEAN },
                            radiusCorner: { type: Type.BOOLEAN },
                            faucetHole: { type: Type.BOOLEAN },
                            drainHole: { type: Type.BOOLEAN }
                        }
                    },
                    backsplashEdgeProfile: { type: Type.NUMBER, description: "Edge profile size in inches (for backsplashes only)." }
                }
            }
        },
        followUpLeads: {
            type: Type.ARRAY,
            description: "A list of leads that are missing information.",
            items: {
                type: Type.OBJECT,
                properties: {
                    customerName: { type: Type.STRING, description: "The full name of the customer, if identifiable." },
                    reason: { type: Type.STRING, description: "A clear, specific, and actionable explanation of why the lead is not ready for a quote. For example: 'Missing required dimension: width.', 'Request for 'diamond-plated finish' is unfamiliar and requires human intervention.', or 'Customer did not specify a material.'" },
                    originalData: { type: Type.STRING, description: "The original text snippet for this lead." }
                }
            }
        }
    }
};

async function handleAnalyzeLeads() {
    const crmData = inputs.crmData.value;
    if (!crmData.trim()) {
        alert("Please paste some CRM data first.");
        return;
    }
    
    containers.aiLoaderOverlay.classList.remove('hidden');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: crmData,
            config: {
                systemInstruction: `You are an expert sales assistant for a luxury metal fabrication shop. Your task is to parse raw CRM text, identify customer leads, and structure them into JSON.

**CRITICAL RULES:**
1.  **Categorize Leads:** Place complete leads in \`quoteReadyLeads\` and incomplete/ambiguous ones in \`followUpLeads\`.
2.  **Extract Core Details:** For each lead, extract \`productType\` ('sink', 'irregular_sink', 'backsplash'), \`dimensions\` (length, width, height), \`material\` ('stainless', 'copper', 'brass'), and \`finish\` ('none', 'prestige', 'hammered').
3.  **EXTRACT ADD-ONS:** This is crucial. Carefully identify all specified add-ons. For \`bowlConfig\`, \`aprons\`, \`ledges\`, \`drainboards\`, use the exact percentage string value from the schema's description. For boolean add-ons like \`faucetDeck\` or \`faucetHole\`, set \`true\` if mentioned. If no add-ons are mentioned, provide an empty \`addOns\` object.
4.  **Handle Ambiguity:** If a customer mentions 'patina' for a copper sink, set \`finish\` to 'hammered'. If they mention 'brushed stainless', set \`finish\` to 'none'.
5.  **Actionable Follow-ups:** For \`followUpLeads\`, provide a \`reason\` that is specific and tells the sales team what to do (e.g., 'Missing sink width.', 'Request for 'custom engraving' is an unfamiliar add-on and requires human review.').

**ANALYTICAL INFERENCE RULES:**
1.  **Resolve Ambiguous Dimensions:** If a customer provides multiple values for a single dimension (e.g., 'a width of 16.2 and 18.4 for a double bowl'), you MUST use the largest value for that dimension and proceed. Do not flag this for follow-up.
2.  **Infer Irregular Complexity:** Use the following descriptions to determine the \`complexity\` for an \`irregular_sink\`. If a description matches, set the level and proceed.
    *   \`level_1\`: Standard L-shape corner sinks.
    *   \`level_2\`: Sinks with linear walls but offsets, bump-outs, or a 'slight curve'.
    *   \`level_3\`: Sinks with non-linear walls or complex curves.
    For example, if a note says 'irregular sink with a slight curve', you MUST infer \`complexity\` is \`level_2\`.

Adhere strictly to the provided JSON schema.`,
                responseMimeType: "application/json",
                responseSchema: leadSchema,
            },
        });

        const jsonString = response.text.trim();
        const potentialLeads = JSON.parse(jsonString);

        if (potentialLeads && potentialLeads.quoteReadyLeads && potentialLeads.followUpLeads) {
            parsedLeads = potentialLeads;
            const { quoteReadyLeads, followUpLeads } = parsedLeads;
            const modalContent = buttons.aiResultsModalContent;

            let contentHTML = `
                <p class="font-semibold text-gray-800">Found <strong>${quoteReadyLeads.length}</strong> lead(s) ready for a quote.</p>
            `;

            if (followUpLeads.length > 0) {
                contentHTML += `
                    <p class="font-semibold text-gray-800 mt-4">Found <strong>${followUpLeads.length}</strong> lead(s) that need follow-up:</p>
                    <ul class="follow-up-list">
                        ${followUpLeads.map(lead => `
                            <li>
                                <strong>${lead.customerName || 'Unknown Lead'}:</strong>
                                <span class="text-gray-600">${lead.reason}</span>
                            </li>
                        `).join('')}
                    </ul>
                `;
            }
            modalContent.innerHTML = contentHTML;

            buttons.modalGenerateQuotes.textContent = `Generate ${quoteReadyLeads.length} Ready Quote(s)`;
            buttons.modalGenerateQuotes.disabled = quoteReadyLeads.length === 0;

            buttons.copyFollowUps.classList.toggle('hidden', followUpLeads.length === 0);
            buttons.copyConfirmation.textContent = '';
            buttons.copyConfirmation.classList.add('opacity-0');

            buttons.aiResultsModal.classList.add('active');
        } else {
             throw new Error("AI did not return valid lead data structure.");
        }

    } catch (error) {
        console.error("Error analyzing leads with AI:", error);
        alert("An error occurred while analyzing the leads. Please check the console for details.");
    } finally {
        containers.aiLoaderOverlay.classList.add('hidden');
    }
}

function handleCopyFollowUps() {
    if (!parsedLeads || !parsedLeads.followUpLeads || parsedLeads.followUpLeads.length === 0) return;

    const headers = ["Customer Name", "Reason for Follow-up", "Original Data"];
    const tsv = [
        headers.join('\t'),
        ...parsedLeads.followUpLeads.map(lead => [
            lead.customerName || 'N/A',
            (lead.reason || '').replace(/[\t\n\r]/g, ' '),
            (lead.originalData || '').replace(/[\t\n\r]/g, ' ')
        ].join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(tsv).then(() => {
        showToast(buttons.copyConfirmation, 'Copied!');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy follow-up data.');
    });
}

function handleGenerateQuotes() {
    if (!parsedLeads || !parsedLeads.quoteReadyLeads || parsedLeads.quoteReadyLeads.length === 0) return;

    aiGeneratedQuotes = []; // Reset

    parsedLeads.quoteReadyLeads.forEach(lead => {
        let result;
        if (lead.productType === 'sink' || lead.productType === 'irregular_sink') {
            result = calculateSinkPrice(lead.productType === 'irregular_sink', lead);
        } else if (lead.productType === 'backsplash') {
            result = calculateBacksplashPrice(lead);
        }

        if (result && result.total > 0) {
            aiGeneratedQuotes.push({
                leadData: lead,
                quoteItem: {
                    mainDescription: result.mainDescription,
                    subItems: result.subItems,
                    price: result.total
                }
            });
        }
    });
    
    parsedLeads = null;
    inputs.crmData.value = '';

    buttons.aiResultsModal.classList.remove('active');
    renderAiExportModal();
}

function renderAiExportModal() {
    const listContainer = containers.aiGeneratedQuotesList;
    if (aiGeneratedQuotes.length === 0) {
        listContainer.innerHTML = `<p class="text-gray-500 text-center py-4">No quotes were generated.</p>`;
        buttons.aiExportAllZip.disabled = true;
    } else {
        listContainer.innerHTML = aiGeneratedQuotes.map((quote, index) => `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div>
                    <p class="font-semibold text-gray-800">${quote.leadData.customerName}</p>
                    <p class="text-sm text-gray-600">${quote.quoteItem.mainDescription} - <span class="font-medium">${formatAsCurrency(quote.quoteItem.price)}</span></p>
                </div>
                <button data-index="${index}" class="export-single-pdf-btn bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                    Export PDF
                </button>
            </div>
        `).join('');

        listContainer.querySelectorAll('.export-single-pdf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt((e.currentTarget as HTMLElement).dataset.index ?? '');
                if (!isNaN(index)) {
                    handleExportSingleAiQuote(index);
                }
            });
        });
        buttons.aiExportAllZip.disabled = false;
    }
    buttons.aiExportModal.classList.add('active');
}

async function handleExportSingleAiQuote(index: number) {
    const quote = aiGeneratedQuotes[index];
    if (!quote) return;

    const subtotal = quote.quoteItem.price;
    const shippingType = inputs.aiShipping.value as keyof typeof PERCENTAGES.shipping;
    const shippingCost = subtotal * (PERCENTAGES.shipping[shippingType] || 0);
    const totalBeforeTax = subtotal + shippingCost;
    const stateTax = inputs.aiTax.checked ? totalBeforeTax * PERCENTAGES.tax.state : 0;
    const countyTax = inputs.aiTax.checked ? totalBeforeTax * PERCENTAGES.tax.county : 0;
    const totalTax = stateTax + countyTax;
    const grandTotal = totalBeforeTax + totalTax;

    const quoteNumber = `${quote.leadData.customerName.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}`;

    await generatePDF({
        items: [quote.quoteItem],
        quoteNumber: quoteNumber,
        customerName: quote.leadData.customerName,
        subtotal: subtotal,
        shippingCost: shippingCost,
        totalTax: totalTax,
        grandTotal: grandTotal,
        outputType: 'save'
    });
}

async function handleExportAllAiQuotesAsZip() {
    if (aiGeneratedQuotes.length === 0) return;

    labels.zipLoader.classList.remove('hidden');
    buttons.aiExportAllZip.disabled = true;

    try {
        const zip = new JSZip();
        const shippingType = inputs.aiShipping.value as keyof typeof PERCENTAGES.shipping;
        const applyTax = inputs.aiTax.checked;

        for (const quote of aiGeneratedQuotes) {
            const subtotal = quote.quoteItem.price;
            const shippingCost = subtotal * (PERCENTAGES.shipping[shippingType] || 0);
            const totalBeforeTax = subtotal + shippingCost;
            const stateTax = applyTax ? totalBeforeTax * PERCENTAGES.tax.state : 0;
            const countyTax = applyTax ? totalBeforeTax * PERCENTAGES.tax.county : 0;
            const totalTax = stateTax + countyTax;
            const grandTotal = totalBeforeTax + totalTax;
            const quoteNumber = `${quote.leadData.customerName.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}`;

            const pdfBlob = await generatePDF({
                items: [quote.quoteItem],
                quoteNumber: quoteNumber,
                customerName: quote.leadData.customerName,
                subtotal,
                shippingCost,
                totalTax,
                grandTotal,
                outputType: 'blob'
            }) as Blob;
            
            zip.file(`Quote_${quoteNumber}.pdf`, pdfBlob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Havens_Quotes_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("Error creating ZIP file:", error);
        alert("An error occurred while creating the ZIP file. Please check the console.");
    } finally {
        labels.zipLoader.classList.add('hidden');
        buttons.aiExportAllZip.disabled = false;
    }
}

// --- QUOTE BUILDER: Resets & Handlers ---
function handleApplyCornerDimensions() {
    const hypotenuse = inputs.modalHypotenuseC.value;
    const armWidth = inputs.modalArmWidth.value;
    if (hypotenuse) inputs.isinkLength.value = hypotenuse;
    if (armWidth) inputs.isinkWidth.value = armWidth;
    buttons.cornerCalcModal.classList.remove('active');
    calculateAndRenderCurrentItem();
}

function handleHypotenuseCalc(event?: Event) {
    const a = parseFloat(inputs.modalWallA.value);
    const b = parseFloat(inputs.modalWallB.value);
    const c = parseFloat(inputs.modalHypotenuseC.value);
    const errorEl = document.getElementById('modal-hypotenuse-error') as HTMLParagraphElement;

    [inputs.modalWallA, inputs.modalWallB, inputs.modalHypotenuseC].forEach(el => {
        el.classList.remove('calculated');
        el.readOnly = false;
    });
    errorEl.classList.add('hidden');

    if (event) hypotenuseLastEdited = (event.target as HTMLElement).id;

    const enteredValues = [a, b, c].filter(v => !isNaN(v) && v > 0);
    if (enteredValues.length < 2) return;

    if (!isNaN(a) && !isNaN(b) && hypotenuseLastEdited !== 'modalHypotenuseC') {
        const result = Math.sqrt(a * a + b * b);
        inputs.modalHypotenuseC.value = result.toFixed(3);
        inputs.modalHypotenuseC.classList.add('calculated');
        inputs.modalHypotenuseC.readOnly = true;
    } else if (!isNaN(a) && !isNaN(c) && hypotenuseLastEdited !== 'modalWallB') {
        if (c <= a) { errorEl.classList.remove('hidden'); return; }
        const result = Math.sqrt(c * c - a * a);
        inputs.modalWallB.value = result.toFixed(3);
        inputs.modalWallB.classList.add('calculated');
        inputs.modalWallB.readOnly = true;
    } else if (!isNaN(b) && !isNaN(c) && hypotenuseLastEdited !== 'modalWallA') {
        if (c <= b) { errorEl.classList.remove('hidden'); return; }
        const result = Math.sqrt(c * c - b * b);
        inputs.modalWallA.value = result.toFixed(3);
        inputs.modalWallA.classList.add('calculated');
        inputs.modalWallA.readOnly = true;
    }
}

function resetSinkCalculator() {
    inputs.sinkLength.value = String(BASE_DIMENSIONS.length);
    inputs.sinkWidth.value = String(BASE_DIMENSIONS.width);
    inputs.sinkHeight.value = String(BASE_DIMENSIONS.height);
    inputs.material.value = 'stainless';
    updateFinishOptions(false);
    inputs.finish.value = 'none';
    inputs.bowlConfig.value = "0";
    inputs.aprons.value = "0";
    inputs.ledges.value = "0";
    inputs.drainboards.value = "0";
    (document.querySelectorAll('#sink-addons-container input[type="checkbox"]') as NodeListOf<HTMLInputElement>).forEach(cb => cb.checked = false);
    calculateAndRenderCurrentItem();
}

function resetIrregularSinkCalculator() {
    inputs.isinkLength.value = String(BASE_DIMENSIONS.length);
    inputs.isinkWidth.value = String(BASE_DIMENSIONS.width);
    inputs.isinkHeight.value = String(BASE_DIMENSIONS.height);
    inputs.imaterial.value = 'stainless';
    updateFinishOptions(true);
    inputs.ifinish.value = 'none';
    inputs.complexity.value = 'level_1';
    (document.querySelectorAll('#sink-addons-container input[type="checkbox"]') as NodeListOf<HTMLInputElement>).forEach(cb => cb.checked = false);
    calculateAndRenderCurrentItem();
}

function resetBacksplashCalculator() {
    inputs.backsplashLength.value = '0';
    inputs.backsplashWidth.value = '0';
    inputs.backsplashMaterial.value = 'luxe';
    inputs.backsplashEdgeProfile.value = '0';
    calculateAndRenderCurrentItem();
}

function init() {
    // --- Initial Setup ---
    navigateTo('dashboard');
    loadTemplates();

    // --- Navigation ---
    buttons.openQuoteBuilder.addEventListener('click', () => {
        updateFinishOptions();
        updateFinishOptions(true);
        switchTab('sink');
        navigateTo('quote-builder');
    });
    buttons.openEmailHelper.addEventListener('click', () => {
        inputs.templateSelect.value = '';
        handleSelectTemplate();
        navigateTo('email-helper');
    });
    buttons.qbBackToDashboard.addEventListener('click', () => navigateTo('dashboard'));
    buttons.ehBackToDashboard.addEventListener('click', () => navigateTo('dashboard'));

    // --- QUOTE BUILDER LISTENERS ---
    [inputs.material, inputs.imaterial].forEach(el => el.addEventListener('change', () => updateFinishOptions(el.id.startsWith('i'))));

    Object.values(inputs).forEach(input => {
        if(input && input.id && !input.id.includes('modal') && !input.id.includes('email') && !input.id.includes('template') && !input.id.startsWith('pdf') && !input.id.startsWith('attachment')) {
          input.addEventListener('input', () => {
              if (currentItemType !== 'ai-parser') {
                calculateAndRenderCurrentItem();
                if (masterQuoteItems.length > 0) renderMasterQuote();
              }
          });
          input.addEventListener('change', () => {
              if (currentItemType !== 'ai-parser') {
                calculateAndRenderCurrentItem();
                if (masterQuoteItems.length > 0) renderMasterQuote();
              }
          });
        }
    });
    
    inputs.complexity.addEventListener('change', updateAddonAvailability);
    [inputs.ifinish, inputs.finish].forEach(f => f.addEventListener('change', updateAddonAvailability));

    buttons.tabSink.addEventListener('click', () => switchTab('sink'));
    buttons.tabIrregular.addEventListener('click', () => switchTab('irregular'));
    buttons.tabBacksplash.addEventListener('click', () => switchTab('backsplash'));
    buttons.tabAiParser.addEventListener('click', () => switchTab('ai-parser'));

    buttons.addToQuote.addEventListener('click', () => {
        const { price, mainDescription, subItems } = buttons.addToQuote.dataset;
        if (price && mainDescription && subItems && parseFloat(price) > 0) {
            masterQuoteItems.push({ 
                mainDescription, 
                price: parseFloat(price),
                subItems: JSON.parse(subItems)
            });
            renderMasterQuote();
            if (currentItemType === 'sink') resetSinkCalculator();
            else if (currentItemType === 'irregular') resetIrregularSinkCalculator();
            else if (currentItemType === 'backsplash') resetBacksplashCalculator();
        }
    });
    buttons.startNewQuote.addEventListener('click', () => {
        masterQuoteItems = [];
        renderMasterQuote();
        if (currentItemType === 'sink') resetSinkCalculator();
        else if (currentItemType === 'irregular') resetIrregularSinkCalculator();
        else if (currentItemType === 'backsplash') resetBacksplashCalculator();
    });
    buttons.exportPdf.addEventListener('click', async () => {
        if (masterQuoteItems.length === 0) {
            alert("Cannot export an empty quote.");
            return;
        }
        const subtotal = masterQuoteItems.reduce((acc, item) => acc + item.price, 0);
        const shippingType = inputs.shipping.value as keyof typeof PERCENTAGES.shipping;
        const shippingCost = subtotal * (PERCENTAGES.shipping[shippingType] || 0);
        const totalBeforeTax = subtotal + shippingCost;
        const stateTax = inputs.tax.checked ? totalBeforeTax * PERCENTAGES.tax.state : 0;
        const countyTax = inputs.tax.checked ? totalBeforeTax * PERCENTAGES.tax.county : 0;
        const totalTax = stateTax + countyTax;
        const grandTotal = totalBeforeTax + totalTax;

        await generatePDF({
            items: masterQuoteItems,
            quoteNumber: inputs.pdfQuoteNumber.value,
            customerName: inputs.pdfCustomerName.value,
            customerAddress: inputs.pdfBillTo.value,
            customerPhone: inputs.pdfCustomerPhone.value,
            customerEmail: inputs.pdfCustomerEmail.value,
            amountPaid: parseFloat(inputs.pdfAmountPaid.value) || 0,
            notes: inputs.pdfNotes.value,
            subtotal,
            shippingCost,
            totalTax,
            grandTotal,
            outputType: 'save'
        });
    });

    inputs.shipping.addEventListener('change', renderMasterQuote);
    inputs.tax.addEventListener('change', renderMasterQuote);

    buttons.guide.addEventListener('click', () => buttons.guideModal.classList.add('active'));
    buttons.guideModalClose.addEventListener('click', () => buttons.guideModal.classList.remove('active'));
    
    buttons.openCornerCalc.addEventListener('click', () => buttons.cornerCalcModal.classList.add('active'));
    buttons.cornerModalClose.addEventListener('click', () => buttons.cornerCalcModal.classList.remove('active'));
    buttons.applyDimensions.addEventListener('click', handleApplyCornerDimensions);
    const cornerInputs = [inputs.modalWallA, inputs.modalWallB, inputs.modalHypotenuseC];
    cornerInputs.forEach(input => input.addEventListener('input', handleHypotenuseCalc));

    // AI Assistant Listeners
    buttons.analyzeLeads.addEventListener('click', handleAnalyzeLeads);
    buttons.copyFollowUps.addEventListener('click', handleCopyFollowUps);
    buttons.modalGenerateQuotes.addEventListener('click', handleGenerateQuotes);
    buttons.aiModalXClose.addEventListener('click', () => buttons.aiResultsModal.classList.remove('active'));
    buttons.aiExportModalClose.addEventListener('click', () => buttons.aiExportModal.classList.remove('active'));
    buttons.doneAiExport.addEventListener('click', () => buttons.aiExportModal.classList.remove('active'));
    buttons.aiExportAllZip.addEventListener('click', handleExportAllAiQuotesAsZip);


    // --- EMAIL HELPER LISTENERS ---
    buttons.newTemplate.addEventListener('click', handleNewTemplate);
    buttons.editTemplate.addEventListener('click', handleEditRequest);
    buttons.cancelEdit.addEventListener('click', handleCancelEdit);
    buttons.saveTemplate.addEventListener('click', handleSaveTemplate);
    buttons.confirmSaveTemplate.addEventListener('click', handleConfirmSave);
    buttons.cancelSaveTemplate.addEventListener('click', () => buttons.saveTemplateModal.classList.remove('active'));
    buttons.deleteTemplate.addEventListener('click', handleDeleteTemplate);
    buttons.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    buttons.cancelDeleteBtn.addEventListener('click', () => buttons.deleteConfirmModal.classList.remove('active'));
    inputs.templateSelect.addEventListener('change', handleSelectTemplate);
    buttons.copyEmail.addEventListener('click', handleCopyEmail);
    inputs.attachmentInput.addEventListener('change', handleAttachmentChange);
    buttons.removeAttachment.addEventListener('click', handleRemoveAttachment);

    // Passcode listeners
    buttons.confirmPasscodeBtn.addEventListener('click', handleConfirmPasscode);
    buttons.cancelPasscodeBtn.addEventListener('click', () => buttons.passcodeModal.classList.remove('active'));
    inputs.passcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmPasscode();
        }
    });
    inputs.passcodeInput.addEventListener('input', () => {
        labels.passcodeError.classList.add('hidden');
    });

    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = (btn as HTMLElement).dataset.command;
            if (command) {
                document.execCommand(command, false, undefined);
                inputs.emailEditor.focus();
            }
        });
    });

    buttons.applyVars.addEventListener('click', handleApplyTemplateVars);
    buttons.cancelVars.addEventListener('click', () => buttons.templateVarsModal.classList.remove('active'));
}

// --- INITIALIZE APP ---
document.addEventListener('DOMContentLoaded', init);