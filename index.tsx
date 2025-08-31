/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Part } from '@google/genai';

// App State
let contentImage: { base64: string; mimeType: string } | null = null;
let styleImage: { base64: string; mimeType: string } | null = null;
let resultImageData: { base64: string; mimeType: string } | null = null;
let styleColorPalette: string[] | null = null;
let isLoading = false;
let selectedEnhancer: string = '';
let selectedAspectRatio: string = '9:16';

const enhancerStyles = [
  'None',
  'Ghibli',
  'Ink Art',
  'Romantic Ink Outline',
  'Warm Watercolor Portrait',
  'Dreamy Wisteria Romance',
  'Golden Hour Embrace',
  'Vibrant Ink Portrait',
  'Sketchbook Romance',
  'Celestial Dreamscape',
  'Hyper realistic fantasy',
  'Cyberpunk',
  'Steampunk',
  'Biomechanical',
  'Solarpunk',
  'Synthwave',
  'Gothic Noir',
  'Cosmic Horror',
  'Dieselpunk',
  'Arcane Punk',
  'Surrealist Dreamscape',
];


// DOM Elements
const contentDropZone = document.getElementById('content-drop-zone') as HTMLDivElement;
const styleDropZone = document.getElementById('style-drop-zone') as HTMLDivElement;
const contentFileInput = document.getElementById('content-file-input') as HTMLInputElement;
const styleFileInput = document.getElementById('style-file-input') as HTMLInputElement;
const contentPreview = document.getElementById('content-preview') as HTMLImageElement;
const stylePreview = document.getElementById('style-preview') as HTMLImageElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const resultPlaceholder = document.getElementById('result-placeholder') as HTMLDivElement;
const resultArea = document.getElementById('result-area') as HTMLDivElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const loaderText = document.getElementById('loader-text') as HTMLSpanElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const upscaleBtn = document.getElementById('upscale-btn') as HTMLButtonElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const clearContentBtn = document.getElementById('clear-content-btn') as HTMLButtonElement;
const clearStyleBtn = document.getElementById('clear-style-btn') as HTMLButtonElement;
const clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
const strengthSlider = document.getElementById('strength-slider') as HTMLInputElement;
const strengthValue = document.getElementById('strength-value') as HTMLSpanElement;
const enhancerSelect = document.getElementById('enhancer-style-select') as HTMLSelectElement;
const aspectRatioSelect = document.getElementById('aspect-ratio-select') as HTMLSelectElement;

// New Color Section Elements
const colorSection = document.getElementById('color-section') as HTMLDivElement;
const colorPaletteDisplay = document.getElementById('color-palette-display') as HTMLDivElement;
const colorIntensitySlider = document.getElementById('color-intensity-slider') as HTMLInputElement;
const colorIntensityValue = document.getElementById('color-intensity-value') as HTMLSpanElement;
const applyColorBtn = document.getElementById('apply-color-btn') as HTMLButtonElement;


/**
 * Updates the state of the main action buttons.
 */
function updateButtonStates() {
  generateBtn.disabled = !contentImage || !styleImage || isLoading;
  upscaleBtn.disabled = !resultImageData || isLoading;
  saveBtn.disabled = !resultImageData || isLoading;
  applyColorBtn.disabled = !resultImageData || !styleColorPalette || isLoading;
}

/**
 * Updates visibility of the color adjustment section.
 */
function updateColorSectionVisibility() {
    if (resultImageData && styleColorPalette) {
        colorSection.style.display = 'block';
    } else {
        colorSection.style.display = 'none';
    }
}


/**
 * Converts a File object to a base64 string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts dominant colors from an image.
 * @param imageData The image data.
 * @param colorCount The number of dominant colors to extract.
 * @param quality A number to adjust performance vs. accuracy.
 * @returns A promise that resolves with an array of hex color strings.
 */
async function extractDominantColors(
    imageData: { base64: string; mimeType: string },
    colorCount = 5,
    quality = 10,
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const width = (canvas.width = img.width);
            const height = (canvas.height = img.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, width, height).data;
            const colorMap: { [key: string]: { color: number[]; count: number } } = {};
            const bucketSize = 32;

            for (let i = 0; i < data.length; i += 4 * quality) {
                const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
                if (a < 125) continue;

                const key = [Math.round(r / bucketSize), Math.round(g / bucketSize), Math.round(b / bucketSize)].join(',');
                if (!colorMap[key]) colorMap[key] = { color: [0, 0, 0], count: 0 };
                
                colorMap[key].color[0] += r;
                colorMap[key].color[1] += g;
                colorMap[key].color[2] += b;
                colorMap[key].count++;
            }
            
            const sortedBuckets = Object.values(colorMap).sort((a, b) => b.count - a.count);
            const dominantColors = sortedBuckets.slice(0, colorCount).map(bucket => {
                const avg = bucket.color.map(c => Math.round(c / bucket.count));
                return `#${avg.map(c => c.toString(16).padStart(2, '0')).join('')}`;
            });
            resolve(dominantColors);
        };
        img.onerror = reject;
        img.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
    });
}

/**
 * Updates the UI to display the extracted color palette.
 */
function updateColorPaletteUI() {
    colorPaletteDisplay.innerHTML = '';
    if (styleColorPalette) {
        styleColorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            colorPaletteDisplay.appendChild(swatch);
        });
    }
}


/**
 * Handles file processing for both content and style images.
 * @param file The image file.
 * @param type The type of image ('content' or 'style').
 */
async function processFile(file: File, type: 'content' | 'style') {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file.');
    return;
  }

  try {
    const base64 = await fileToBase64(file);
    const imageData = { base64, mimeType: file.type };
    const preview = type === 'content' ? contentPreview : stylePreview;
    const dropZone = type === 'content' ? contentDropZone : styleDropZone;

    if (type === 'content') {
      contentImage = imageData;
    } else {
      styleImage = imageData;
      // Extract colors when style image is loaded
      extractDominantColors(imageData)
        .then(colors => {
            styleColorPalette = colors;
            updateColorPaletteUI();
            updateButtonStates();
            updateColorSectionVisibility();
        })
        .catch(err => {
            console.error('Error extracting colors:', err);
            alert('Could not extract colors from style image.');
        });
    }

    preview.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
    dropZone.classList.add('has-image');
    updateButtonStates();
  } catch (error) {
    console.error('Error processing file:', error);
    alert('Error processing file. Please try again.');
  }
}

/**
 * Clears the selected image and resets the UI.
 * @param type The type of image to clear ('content' or 'style').
 */
function clearImage(type: 'content' | 'style') {
  const fileInput = type === 'content' ? contentFileInput : styleFileInput;
  const preview = type === 'content' ? contentPreview : stylePreview;
  const dropZone = type === 'content' ? contentDropZone : styleDropZone;

  if (type === 'content') {
    contentImage = null;
  } else {
    styleImage = null;
    styleColorPalette = null;
    updateColorPaletteUI();
  }

  fileInput.value = '';
  preview.src = '';
  dropZone.classList.remove('has-image');

  // If an input is cleared, the result and color section are no longer valid.
  resultImageData = null;
  resultImage.src = '';
  resultImage.style.display = 'none';
  resultPlaceholder.style.display = 'flex';
  updateColorSectionVisibility();
  updateButtonStates();
}

/**
 * Resets the entire application to its default state.
 */
function handleClearAll() {
  // Clear both input images, which also clears the result, color palette, and hides sections.
  clearImage('content');
  clearImage('style');

  // Reset sliders to default values
  strengthSlider.value = '50';
  strengthValue.textContent = '50%';
  colorIntensitySlider.value = '50';
  colorIntensityValue.textContent = '50%';

  // Reset dropdowns to their default selections
  enhancerSelect.value = '';
  selectedEnhancer = '';
  aspectRatioSelect.value = '9:16';
  selectedAspectRatio = '9:16';
  
  // Update the result area preview to match the default aspect ratio
  resultArea.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');

  // Note: The calls to clearImage() already handle updating button states
  // and hiding the color section, so we don't need to do it again here.
}


/**
 * Sets up event listeners for a drop zone.
 * @param dropZone The drop zone element.
 * @param fileInput The corresponding file input element.
 * @param type The type of image ('content' or 'style').
 */
function setupDropZone(
  dropZone: HTMLDivElement,
  fileInput: HTMLInputElement,
  type: 'content' | 'style',
) {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer?.files[0]) {
      processFile(e.dataTransfer.files[0], type);
    }
  });
  fileInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
      processFile(target.files[0], type);
    }
  });
}

/**
 * Sets the loading state of the application.
 * @param loading Whether the app is loading.
 * @param message The message to display on the loader.
 */
function setLoading(loading: boolean, message: string = 'Generating...') {
  isLoading = loading;
  loader.style.display = loading ? 'flex' : 'none';
  loaderText.textContent = message;

  if (loading) {
    resultImage.style.display = 'none';
    resultPlaceholder.style.display = 'none';
  }
  updateButtonStates();
}

/**
 * Populates the enhancer style dropdown with options.
 */
function populateEnhancerDropdown() {
    enhancerStyles.forEach(style => {
        const option = document.createElement('option');
        option.value = style === 'None' ? '' : style;
        option.textContent = style;
        enhancerSelect.appendChild(option);
    });
}

/**
 * Handles the generate button click event to call the Gemini API.
 */
async function handleGenerate() {
  if (!contentImage || !styleImage || isLoading) return;

  setLoading(true, 'Generating...');
  resultImageData = null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const strength = parseInt(strengthSlider.value, 10);
    let strengthInstruction = '';
    if (strength <= 25) {
        strengthInstruction = 'The style should be a very subtle influence, with the content image remaining dominant.';
    } else if (strength <= 50) {
        strengthInstruction = 'Create a balanced blend between the content and the style.';
    } else if (strength <= 75) {
        strengthInstruction = 'The style should be dominant, significantly transforming the content image.';
    } else {
        strengthInstruction = 'Completely reimagine the content image in the provided style, making the style as strong as possible.';
    }

    let prompt = '';

    if (selectedEnhancer === 'Ghibli') {
      prompt = `Your task is a specialized artistic transformation. You must redraw the content image in the iconic and beloved Ghibli art style. The final image should evoke a deep sense of nostalgia, wonder, and hand-painted charm.

Key characteristics to replicate:
- **Lush, Painterly Backgrounds:** Create beautiful, detailed backgrounds inspired by watercolor paintings. Emphasize natural elements like fluffy, voluminous clouds, rich green foliage, and sparkling water.
- **Soft, Nostalgic Lighting:** The scene should be illuminated with a warm, gentle light. Create a soft, almost dreamlike atmosphere.
- **Clean & Expressive Characters:** Characters from the content image should be rendered with clean, distinct outlines and simple, soft shading. Their features should be expressive and charming.
- **Vibrant & Gentle Colors:** Use a rich and vibrant color palette that feels natural and harmonious, avoiding harsh or overly saturated tones.

The provided style image should heavily influence the overall color and texture, while the content image defines the subject and composition. ${strengthInstruction}`;
    } else {
      prompt = `Your task is to perform a radical and dramatic artistic style transfer. You must completely transform the content image into a new piece of art that looks like a painted ink art piece, created in the style of the style image. Heavily prioritize the style image's aesthetic above all else, making it the dominant force in the final output. Replicate its textured brushstrokes, its charcoal and watercolor feel, and its subtle imperfections. The content image should only serve as a very loose guide for the subject matter and composition; do not preserve its original photographic quality. Add dramatic, stylized details like bold border lines, artistically rendered hair, and rich textures or abstract designs in the background to create a complete, stylized scene. ${strengthInstruction}`;

      if (selectedEnhancer) {
          prompt += ` Finally, infuse the result with a strong ${selectedEnhancer} aesthetic.`;
      }
    }

    prompt += ` The final image must have a ${selectedAspectRatio} aspect ratio.`;

    const parts: Part[] = [
      { text: 'This is the content image:' },
      { inlineData: { data: contentImage.base64, mimeType: contentImage.mimeType } },
      { text: 'This is the style image:' },
      { inlineData: { data: styleImage.base64, mimeType: styleImage.mimeType } },
      { text: prompt },
    ];
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    
    let foundImage = false;
    for (const part of response.candidates?.[0]?.content.parts ?? []) {
      if (part.inlineData) {
        const { data, mimeType } = part.inlineData;
        resultImageData = { base64: data, mimeType };
        resultImage.src = `data:${mimeType};base64,${data}`;
        resultImage.style.display = 'block';
        foundImage = true;
        break;
      }
    }

    if (!foundImage) {
      throw new Error('API response did not contain an image.');
    }
  } catch (error) {
    console.error('API Error:', error);
    alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    resultPlaceholder.style.display = 'flex';
  } finally {
    setLoading(false);
    updateColorSectionVisibility();
  }
}

/**
 * Applies the extracted color palette to the result image.
 */
async function handleApplyColor() {
    if (!resultImageData || !styleColorPalette || isLoading) return;

    setLoading(true, 'Applying Colors...');
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const intensity = parseInt(colorIntensitySlider.value, 10);
        const palette = styleColorPalette.join(', ');

        const prompt = `Adjust the color scheme of this image. Apply the following color palette: [${palette}]. The intensity of this adjustment should be ${intensity}%. A lower intensity means a subtle tonal shift, while a higher intensity means the image's colors should closely match the provided palette. Do not change the composition, structure, or underlying style of the image; only adjust the colors to reflect the new palette.`;

        const parts: Part[] = [
            { inlineData: { data: resultImageData.base64, mimeType: resultImageData.mimeType } },
            { text: prompt },
        ];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        let foundImage = false;
        for (const part of response.candidates?.[0]?.content.parts ?? []) {
            if (part.inlineData) {
                const { data, mimeType } = part.inlineData;
                resultImageData = { base64: data, mimeType };
                resultImage.src = `data:${mimeType};base64,${data}`;
                resultImage.style.display = 'block';
                foundImage = true;
                break;
            }
        }
        if (!foundImage) throw new Error('API response did not contain a color-adjusted image.');

    } catch (error) {
        console.error('API Error during color application:', error);
        alert(`An error occurred during color application: ${error instanceof Error ? error.message : String(error)}`);
        resultImage.style.display = 'block'; // Show old result if it fails
    } finally {
        setLoading(false);
    }
}

/**
 * Sends the result image back to the API for upscaling.
 */
async function handleUpscale() {
  if (!resultImageData || isLoading) return;

  setLoading(true, 'Upscaling...');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = 'Please upscale this image. Increase its resolution and enhance the details, while preserving the existing artistic style.';

    const parts: Part[] = [
      { inlineData: { data: resultImageData.base64, mimeType: resultImageData.mimeType } },
      { text: prompt },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let foundImage = false;
    for (const part of response.candidates?.[0]?.content.parts ?? []) {
      if (part.inlineData) {
        const { data, mimeType } = part.inlineData;
        resultImageData = { base64: data, mimeType }; // Update with upscaled image
        resultImage.src = `data:${mimeType};base64,${data}`;
        resultImage.style.display = 'block';
        foundImage = true;
        break;
      }
    }

    if (!foundImage) {
      throw new Error('API response did not contain an upscaled image.');
    }
  } catch (error) {
    console.error('API Error during upscale:', error);
    alert(`An error occurred during upscaling: ${error instanceof Error ? error.message : String(error)}`);
    // Show the old result image if upscaling fails
    resultImage.style.display = 'block';
  } finally {
    setLoading(false);
  }
}

/**
 * Triggers a download of the current result image.
 */
function handleSave() {
  if (!resultImageData) return;

  const link = document.createElement('a');
  link.href = `data:${resultImageData.mimeType};base64,${resultImageData.base64}`;
  const extension = resultImageData.mimeType.split('/')[1]?.split('+')[0] || 'png';
  link.download = `styled-image-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  setupDropZone(contentDropZone, contentFileInput, 'content');
  setupDropZone(styleDropZone, styleFileInput, 'style');
  clearContentBtn.addEventListener('click', () => clearImage('content'));
  clearStyleBtn.addEventListener('click', () => clearImage('style'));
  clearAllBtn.addEventListener('click', handleClearAll);
  generateBtn.addEventListener('click', handleGenerate);
  upscaleBtn.addEventListener('click', handleUpscale);
  saveBtn.addEventListener('click', handleSave);
  applyColorBtn.addEventListener('click', handleApplyColor);
  
  strengthSlider.addEventListener('input', () => {
    strengthValue.textContent = `${strengthSlider.value}%`;
  });
  colorIntensitySlider.addEventListener('input', () => {
    colorIntensityValue.textContent = `${colorIntensitySlider.value}%`;
  });

  populateEnhancerDropdown();
  enhancerSelect.addEventListener('change', () => {
    selectedEnhancer = enhancerSelect.value;
  });

  aspectRatioSelect.addEventListener('change', () => {
    selectedAspectRatio = aspectRatioSelect.value;
    resultArea.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');
  });
  // Set initial aspect ratio for the result area preview
  resultArea.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');
});

export {};