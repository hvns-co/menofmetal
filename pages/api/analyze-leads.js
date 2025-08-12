
import { GoogleGenAI, Type } from "@google/genai";

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


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { crmData } = req.body;
    if (!crmData || !crmData.trim()) {
        return res.status(400).json({ message: 'crmData is required' });
    }

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
            res.status(200).json(potentialLeads);
        } else {
             throw new Error("AI did not return valid lead data structure.");
        }

    } catch (error) {
        console.error("Error analyzing leads with AI:", error);
        res.status(500).json({ message: "An error occurred while analyzing the leads. Please check the console for details." });
    }
}
