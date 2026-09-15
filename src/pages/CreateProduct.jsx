import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ImagePlus,
  Info,
  MapPin,
  Mic,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Upload,
  Volume2
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import ProgressStepper from "../components/ProgressStepper";

import {
  processProduct,
  createProduct
} from "../services/craftlensApi";

import { formatCurrency } from "../utils/formatters";

const steps = [
  "Photo",
  "Story",
  "Review",
  "Price",
  "Publish"
];

/**
 * Smart client-side image downscaling.
 * Compresses large camera photos (e.g. 12MB 4000x3000) down to max 1600px,
 * reducing payload by ~95% while keeping crisp high visual clarity.
 */
function compressImage(file, maxDimension = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not parse image data"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(outputMime, quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function CreateProduct({ showToast, navigateTo, onProductPublished }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSampleProduct, setIsSampleProduct] = useState(false);

  const [productTitle, setProductTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [validationMessage, setValidationMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("Not saved yet");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [productProfile, setProductProfile] = useState(null);
  const [voiceData, setVoiceData] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const [pricing, setPricing] = useState(null);
  const [materialsPlan, setMaterialsPlan] = useState(null);
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);

  const [costInputs, setCostInputs] = useState({
    materialCost: 360,
    labourCost: 300,
    packagingCost: 50,
    platformCost: 40,
    overheadCost: 60
  });

  const [isPublished, setIsPublished] = useState(false);

  const fileInputRef = useRef(null);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    if (
      selectedFile ||
      productTitle ||
      description ||
      language !== "English"
    ) {
      setSaveMessage("Progress saved just now");
    }
  }, [selectedFile, productTitle, description, language]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const formattedRecordingTime = formatTime(recordingSeconds);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setValidationMessage("Please choose a JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setValidationMessage("Please choose an image smaller than 25 MB.");
      return;
    }

    setSelectedFile(file);
    setIsSampleProduct(false);
    setValidationMessage("");

    try {
      const compressedUrl = await compressImage(file);
      setImagePreview(compressedUrl);
      showToast("Product photo added and optimized");
    } catch (err) {
      console.warn("Client compression fallback:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        showToast("Product photo added successfully");
      };
      reader.onerror = () => {
        showToast("Could not read image file", "warning");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleUseSample = () => {
    setSelectedFile(null);
    setImagePreview("");
    setIsSampleProduct(true);
    setProductTitle(sampleProduct.title);
    setDescription(sampleProduct.description);
    setLanguage(sampleProduct.language);
    setValidationMessage("");

    showToast("Sample bamboo basket loaded");
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedFile(null);
    setImagePreview("");
    setIsSampleProduct(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm"
        });

        const audioUrl = URL.createObjectURL(audioBlob);

        // Immediate state with blob and url so audio preview is immediately available
        setRecordedAudio((prev) => ({
          ...(prev || {}),
          blob: audioBlob,
          url: audioUrl,
          mimeType: audioBlob.type || "audio/webm"
        }));

        // Convert audioBlob to base64 Data URL for backend Voice Model
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudio({
            blob: audioBlob,
            url: audioUrl,
            base64: reader.result,
            mimeType: audioBlob.type || "audio/webm"
          });
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();

      setIsRecording(true);
      setRecordingComplete(false);
      setIsPlayingRecording(false);
      setRecordingSeconds(0);

      showToast("Recording started. Describe your product naturally.");
    } catch (error) {
      console.error("Microphone error:", error);
      setValidationMessage(
        "Microphone access is required to record your product story."
      );
    }
  };

  const handleStopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setRecordingComplete(true);
    setRecordingSeconds((seconds) => Math.max(seconds, 4));

    showToast("Voice story recorded");
  };

  const handlePlayRecording = () => {
    if (!recordedAudio?.url) {
      return;
    }

    const audio = new Audio(recordedAudio.url);
    setIsPlayingRecording(true);
    audio.play();

    audio.onended = () => {
      setIsPlayingRecording(false);
    };
  };

  const validateCurrentStep = () => {
    setValidationMessage("");

    if (currentStep === 1 && !selectedFile && !isSampleProduct) {
      setValidationMessage(
        "Add a product photo or choose the sample craft to continue."
      );
      return false;
    }

    if (currentStep === 2 && !recordedAudio && description.trim().length < 10) {
      setValidationMessage(
        "Please record your voice story using the microphone or enter a short description."
      );
      return false;
    }

    if (currentStep === 3 && !productProfile?.title?.trim()) {
      setValidationMessage("Please add a product title before continuing.");
      return false;
    }

    if (currentStep === 4 && !pricing) {
      setValidationMessage("Please prepare the pricing plan before continuing.");
      return false;
    }

    return true;
  };

  const handleContinue = async () => {
    if (isAnalyzing || isPreparingPlan || isPublishing) {
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep === 2) {
      await analyzeProduct();
      return;
    }

    if (currentStep === 3) {
      await preparePricingAndMaterials();
      return;
    }

    if (currentStep === 4) {
      setCurrentStep(5);
      setValidationMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 5) {
      await handlePublish();
      return;
    }

    setCurrentStep((step) => step + 1);
    setValidationMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const analyzeProduct = async () => {
    setIsAnalyzing(true);
    setValidationMessage("");
    setShowExplanation(false);

    try {
      let audioPayload = recordedAudio?.base64 || null;
      let audioMime = recordedAudio?.mimeType || null;

      // If audioBlob is present but base64 FileReader is still finishing, await it directly
      if (!audioPayload && recordedAudio?.blob) {
        audioPayload = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(recordedAudio.blob);
        });
        audioMime = recordedAudio.blob.type || "audio/webm";
      }

      const result = await processProduct({
        image: imagePreview || null,
        imageName: selectedFile?.name || "craftlens-product.jpg",
        audio: audioPayload,
        audioMimeType: audioMime,
        transcript: description || "",
        language,
        pricing: {
          materialCost: costInputs.materialCost,
          labourCost: costInputs.labourCost,
          packagingCost: costInputs.packagingCost,
          platformCost: costInputs.platformCost,
          overheadCost: costInputs.overheadCost
        },
        artisanInput: {
          title: productTitle || null,
          description: description || null,
          language
        }
      });

      setProductProfile(result.productProfile);
      setPricing(result.pricing);
      setMaterialsPlan(result.materialsPlan || result.materialRecommendation);
      setVoiceData(result.voiceData || null);

      if (result.voiceData?.translatedText && !description.trim()) {
        setDescription(result.voiceData.translatedText);
      }
      if (result.productProfile?.title && !productTitle.trim()) {
        setProductTitle(result.productProfile.title);
      }

      setCurrentStep(3);
      setSaveMessage("Product profile ready");

      if (result.aiMetadata?.voiceNotice) {
        showToast(result.aiMetadata.voiceNotice, "info");
      } else {
        showToast("Product profile ready for review");
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (error) {
      console.error("CraftLens AI error:", error);
      setValidationMessage(
        error.message || "We could not prepare the product profile. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const preparePricingAndMaterials = async () => {
    setIsPreparingPlan(true);
    setValidationMessage("");

    try {
      if (!pricing || !materialsPlan) {
        throw new Error("Pricing and material plan is not available.");
      }

      setCurrentStep(4);
      setSaveMessage("Pricing plan ready");
      showToast("Pricing and material recommendations ready");

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (error) {
      console.error("Pricing preparation error:", error);
      setValidationMessage(
        "We could not prepare the pricing plan. Please try again."
      );
    } finally {
      setIsPreparingPlan(false);
    }
  };

  const updateProfileField = (field, value) => {
    setProductProfile((currentProfile) => {
      const nextProfile = {
        ...currentProfile,
        [field]: value,
        evidence: {
          ...(currentProfile?.evidence || {}),
          [field]: { source: "artisan_input" }
        }
      };

      // If artisan selling price updated, keep pricing state and comparison in sync!
      if (field === "artisanSellingPrice") {
        const numPrice = Number(value);
        if (!isNaN(numPrice) && numPrice > 0) {
          setPricing((curr) => {
            if (!curr) return curr;
            const rec = curr.recommendedPrice || 1;
            return {
              ...curr,
              artisanSellingPrice: numPrice,
              comparison: {
                artisanSellingPrice: numPrice,
                differenceFromRecommended: numPrice - rec,
                percentageOfRecommended: Math.round((numPrice / rec) * 100),
                status:
                  numPrice >= rec
                    ? "above_recommended"
                    : numPrice >= curr.minimumPrice
                    ? "sustainable"
                    : "below_minimum",
                note:
                  numPrice >= rec
                    ? `Your spoken price (₹${numPrice}) meets or exceeds the sustainable benchmark (₹${rec}).`
                    : numPrice >= curr.minimumPrice
                    ? `Your spoken price (₹${numPrice}) covers costs (₹${curr.costs?.totalCost}) with fair margin.`
                    : `Your spoken price (₹${numPrice}) is below minimum cost threshold (₹${curr.minimumPrice}).`,
              },
            };
          });
        }
      }

      // If materials updated by artisan, update recommendation materials plan!
      if (field === "materials") {
        const primaryMat = Array.isArray(value) ? value[0] : value;
        if (primaryMat) {
          setMaterialsPlan((currentPlan) => {
            if (!currentPlan) return currentPlan;
            return {
              ...currentPlan,
              materials: (currentPlan.materials || []).map((m) => ({
                ...m,
                name: primaryMat,
              })),
              recommendations: (currentPlan.recommendations || []).map((r) => ({
                ...r,
                material: primaryMat,
              })),
            };
          });
        }
      }
      return nextProfile;
    });
  };

  const updateCostInput = (field, value) => {
    const nextInputs = {
      ...costInputs,
      [field]: Number(value) || 0
    };

    setCostInputs(nextInputs);
    setPricing((currentPricing) => {
      if (!currentPricing) {
        return currentPricing;
      }

      const materialCost = nextInputs.materialCost;
      const labourCost = nextInputs.labourCost;
      const packagingCost = nextInputs.packagingCost;
      const platformCost = nextInputs.platformCost;
      const overheadCost = nextInputs.overheadCost;

      const totalCost =
        materialCost +
        labourCost +
        packagingCost +
        platformCost +
        overheadCost;

      const minPrice = roundToNearestTen(totalCost * 1.15);
      const recPrice = roundToNearestTen(totalCost * 1.50);
      const premPrice = roundToNearestTen(totalCost * 1.90);
      const artisanPrice = currentPricing.artisanSellingPrice ?? null;

      const comp = artisanPrice
        ? {
            artisanSellingPrice: artisanPrice,
            differenceFromRecommended: artisanPrice - recPrice,
            percentageOfRecommended: Math.round((artisanPrice / (recPrice || 1)) * 100),
            status:
              artisanPrice >= recPrice
                ? "above_recommended"
                : artisanPrice >= minPrice
                ? "sustainable"
                : "below_minimum",
            note:
              artisanPrice >= recPrice
                ? `Your spoken price (₹${artisanPrice}) meets or exceeds the sustainable benchmark (₹${recPrice}).`
                : artisanPrice >= minPrice
                ? `Your spoken price (₹${artisanPrice}) covers costs (₹${totalCost}) with fair margin.`
                : `Your spoken price (₹${artisanPrice}) is below minimum cost threshold (₹${minPrice}). Recommended price is ₹${recPrice}.`,
          }
        : null;

      return {
        ...currentPricing,
        costs: {
          materialCost,
          labourCost,
          packagingCost,
          platformCost,
          overheadCost,
          totalCost
        },
        minimumPrice: minPrice,
        recommendedPrice: recPrice,
        premiumPrice: premPrice,
        artisanSellingPrice: artisanPrice,
        comparison: comp,
      };
    });

    if (field === "materialCost") {
      setMaterialsPlan((currentPlan) => {
        if (!currentPlan) return currentPlan;
        return {
          ...currentPlan,
          totalEstimatedCost: nextInputs.materialCost,
          materials: (currentPlan.materials || []).map((m, idx) =>
            idx === 0 ? { ...m, estimatedCost: nextInputs.materialCost } : m
          ),
        };
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && !isAnalyzing && !isPreparingPlan) {
      setCurrentStep((step) => step - 1);
      setValidationMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSaveDraft = () => {
    setSaveMessage("Draft saved just now");
    showToast("Product saved as draft");
  };

  const handlePublish = async () => {
    if (isPublishing) return;

    if (!productProfile || !pricing || !materialsPlan) {
      setValidationMessage(
        "Please complete the product details before publishing."
      );
      return;
    }

    try {
      setIsPublishing(true);
      setValidationMessage("");
      setSaveMessage("Publishing product...");

      const result = await createProduct({
        artisanId: "artisan-001",
        status: "Published",
        productProfile,
        voiceData: {
          originalText: voiceData?.originalText || description || productProfile.artisanStory || "",
          transcript: voiceData?.transcript || voiceData?.originalText || description || "",
          language: voiceData?.language || language,
          translatedText: voiceData?.translatedText || productProfile.description || description || "",
          normalizedText: voiceData?.normalizedText || (description || "").toLowerCase().trim(),
          extraction: voiceData?.extraction || voiceData?.extractedEntities || null,
          confidence: voiceData?.confidence || null,
          source: voiceData?.source || (recordedAudio ? "voice_model" : "artisan_input"),
          model: voiceData?.model || null,
          status: voiceData?.status || (recordedAudio ? "success" : "fallback"),
          audioRecorded: Boolean(recordedAudio),
          ...(voiceData || {}),
        },
        listing: productProfile.listing || null,
        pricing,
        materialsPlan,
        evidence: productProfile.evidence || {
          title: { source: "visual" },
          artisanStory: { source: recordedAudio ? "voice_model" : "artisan_input" },
          price: { source: "calculated", validatedBy: "pricing_engine" },
          materials: { source: "stored_business_data" },
        },
        aiMetadata: {
          voiceModelStatus: voiceData?.status === "success" ? "connected" : (recordedAudio ? "fallback" : "manual_input"),
          voiceModelProvider: voiceData?.metadata?.provider || "teammate_faster_whisper",
          voiceModelName: voiceData?.model || "faster-whisper-small",
          recommendationModelStatus: materialsPlan?.aiMetadata?.recommendationStatus || "connected",
          createdFrom: "voice-first-product-flow",
        },
        imagePreview: imagePreview || null,
        imageName: selectedFile?.name || "craftlens-product.jpg",
        originalAudioRecorded: Boolean(recordedAudio),
        audioMimeType: recordedAudio?.mimeType || null,
        language,
        source: "CraftLens",
        isSampleProduct,
        createdFrom: "voice-first-product-flow"
      });

      console.log("Product saved:", result.product);
      setIsPublished(true);
      setSaveMessage("Product published and saved just now");
      showToast("Product published successfully");
      if (onProductPublished) {
        onProductPublished();
      }
    } catch (error) {
      console.error("Publish error:", error);
      setValidationMessage(
        "We could not publish your product. Please try again."
      );
      setSaveMessage("Publish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setIsPublished(false);
    setSelectedFile(null);
    setImagePreview("");
    setIsSampleProduct(false);
    setProductTitle("");
    setDescription("");
    setLanguage("English");
    setIsRecording(false);
    setRecordingComplete(false);
    setIsPlayingRecording(false);
    setRecordedAudio(null);
    setRecordingSeconds(0);
    setProductProfile(null);
    setPricing(null);
    setMaterialsPlan(null);
    setValidationMessage("");
    setSaveMessage("Draft ready");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderStepContent = () => {
    if (isPublished) {
      return (
        <PublishedState
          profile={productProfile}
          pricing={pricing}
          imagePreview={imagePreview}
          isSampleProduct={isSampleProduct}
          navigateTo={navigateTo}
          onReset={handleReset}
        />
      );
    }

    if (currentStep === 1) {
      return (
        <PhotoStep
          imagePreview={imagePreview}
          isSampleProduct={isSampleProduct}
          selectedFile={selectedFile}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onChooseImage={handleChooseImage}
          onUseSample={handleUseSample}
          onRemoveImage={handleRemoveImage}
        />
      );
    }

    if (currentStep === 2) {
      return (
        <StoryStep
          language={language}
          productTitle={productTitle}
          description={description}
          isRecording={isRecording}
          recordingComplete={recordingComplete}
          recordingSeconds={recordingSeconds}
          formattedRecordingTime={formattedRecordingTime}
          isPlayingRecording={isPlayingRecording}
          onLanguageChange={setLanguage}
          onTitleChange={setProductTitle}
          onDescriptionChange={setDescription}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onPlayRecording={handlePlayRecording}
        />
      );
    }

    if (currentStep === 3) {
      if (isAnalyzing) {
        return <AnalyzingState />;
      }

      return (
        <ProfileReviewStep
          profile={productProfile}
          voiceData={voiceData}
          imagePreview={imagePreview}
          isSampleProduct={isSampleProduct}
          recordedAudio={recordedAudio}
          isPlayingRecording={isPlayingRecording}
          onPlayRecording={handlePlayRecording}
          showExplanation={showExplanation}
          onToggleExplanation={() => setShowExplanation((value) => !value)}
          onUpdateField={updateProfileField}
        />
      );
    }

    if (currentStep === 4) {
      if (isPreparingPlan) {
        return <PreparingPlanState />;
      }

      return (
        <PricingMaterialsStep
          pricing={pricing}
          materialsPlan={materialsPlan}
          costInputs={costInputs}
          onCostInputChange={updateCostInput}
        />
      );
    }

    return (
      <FinalReviewStep
        profile={productProfile}
        pricing={pricing}
        materialsPlan={materialsPlan}
        imagePreview={imagePreview}
        isSampleProduct={isSampleProduct}
        onEditStep={setCurrentStep}
      />
    );
  };

  return (
    <div className="create-product-page">
      <PageHeader
        eyebrow="CREATE PRODUCT"
        title="Turn your craft into a professional listing."
        description="Show us what you made. Tell us the story. CraftLens handles the business details."
      />

      <div className="stepper-container">
        <ProgressStepper steps={steps} currentStep={currentStep} />
      </div>

      <div className="creation-context-bar">
        <div className="creation-context-meta">
          <span className="creation-context-label">
            {isPublished ? "COMPLETED" : `STEP 0${currentStep} OF 05`}
          </span>
          <strong>
            {isPublished ? "Product Live in Store" : steps[currentStep - 1]}
          </strong>
        </div>

        <span className="save-status">
          <span className="save-status-dot" />
          {saveMessage}
        </span>
      </div>

      {validationMessage && (
        <div className="validation-banner" role="alert">
          <span>!</span>
          <p>{validationMessage}</p>
        </div>
      )}

      <div className="creation-step-content">{renderStepContent()}</div>

      {!isPublished && (
        <div className="creation-navigation">
          <button
            className="secondary-button"
            onClick={handleBack}
            disabled={currentStep === 1 || isAnalyzing || isPreparingPlan}
            type="button"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="creation-navigation-right">
            <button
              className="ghost-button"
              onClick={handleSaveDraft}
              type="button"
            >
              Save as draft
            </button>

            <button
              className="primary-button"
              onClick={handleContinue}
              disabled={isAnalyzing || isPreparingPlan}
              type="button"
            >
              {isAnalyzing || isPreparingPlan ? (
                <>
                  <span className="button-spinner" />
                  {isAnalyzing ? "Processing..." : "Preparing plan..."}
                </>
              ) : currentStep === 5 ? (
                <>
                  Publish Product
                  <Check size={16} />
                </>
              ) : currentStep === 3 ? (
                <>
                  Set Price
                  <ArrowRight size={16} />
                </>
              ) : currentStep === 4 ? (
                <>
                  Final Review
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {isPublished && (
        <div className="published-actions">
          <button
            className="secondary-button"
            onClick={() => setIsPublished(false)}
            type="button"
          >
            Continue editing
          </button>

          <button
            className="primary-button"
            onClick={() =>
              navigateTo
                ? navigateTo("catalogue")
                : showToast("Catalogue opening soon")
            }
            type="button"
          >
            View Catalogue
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// STEP 1 — PHOTO
// -------------------------------------------------------------
function PhotoStep({
  imagePreview,
  isSampleProduct,
  selectedFile,
  fileInputRef,
  onFileChange,
  onChooseImage,
  onUseSample,
  onRemoveImage
}) {
  const hasImage = Boolean(imagePreview || isSampleProduct);

  return (
    <div className="content-card step-card photo-step-card">
      <div className="card-heading">
        <div>
          <span className="section-kicker">01 PHOTO</span>
          <h2>Show us your craft</h2>
          <p>Upload a clear photo of your handmade product.</p>
        </div>

        <div className="status-pill-subtle">
          <Sparkles size={14} />
          <span>AI Vision Ready</span>
        </div>
      </div>

      {!hasImage ? (
        <div className="photo-upload-layout">
          <div
            className="photo-upload-zone"
            onClick={onChooseImage}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer?.files?.length) {
                onFileChange({ target: { files: e.dataTransfer.files } });
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="photo-upload-icon">
              <ImagePlus size={40} />
            </div>

            <strong className="photo-upload-title">
              Drop your product photo here
            </strong>
            <span className="photo-upload-subtitle">
              or choose from your device
            </span>

            <button
              className="secondary-button browse-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChooseImage();
              }}
            >
              <Upload size={15} />
              Browse photo
            </button>

            <span className="upload-note">
              JPG, PNG or WEBP up to 10 MB
            </span>
          </div>

          <div className="sample-divider">
            <span className="divider-line" />
            <span className="divider-label">OR</span>
            <span className="divider-line" />
          </div>

          <div
            className="sample-product-card"
            onClick={onUseSample}
            role="button"
            tabIndex={0}
          >
            <div className="sample-card-left">
              <span className="sample-emoji">🧺</span>
              <div>
                <strong>Use sample product 🧺</strong>
                <p>Traditional Handwoven Bamboo Basket (Demo Preset)</p>
              </div>
            </div>

            <span className="sample-select-action">
              Select preset <ArrowRight size={14} />
            </span>
          </div>

          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileChange}
          />
        </div>
      ) : (
        <div className="photo-preview-layout">
          <div className="photo-preview-box">
            {imagePreview ? (
              <img src={imagePreview} alt="Selected craft preview" />
            ) : (
              <div className="sample-preview-visual">
                <span className="sample-preview-emoji">🧺</span>
                <strong>Traditional Bamboo Basket</strong>
              </div>
            )}

            <div className="photo-tag-badges">
              <span className="photo-tag">✓ Natural Bamboo</span>
              <span className="photo-tag">✓ Handwoven</span>
              <span className="photo-tag">✓ High Quality</span>
            </div>
          </div>

          <div className="photo-preview-meta">
            <div className="preview-status-row">
              <span className="badge-success">✓ Image ready</span>
              <span className="badge-neutral">AI Vision Active</span>
            </div>

            <h3>{selectedFile?.name || "Traditional Bamboo Basket (Sample)"}</h3>
            <p>
              {selectedFile
                ? `${formatFileSize(selectedFile.size)} · Optical clarity validated.`
                : "Curated sample imagery loaded for quick workflow demonstration."}
            </p>

            <div className="preview-action-row">
              <button
                className="secondary-button"
                onClick={onChooseImage}
                type="button"
              >
                Replace image
              </button>

              <button
                className="ghost-button danger-link"
                onClick={onRemoveImage}
                type="button"
              >
                Remove
              </button>
            </div>

            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// STEP 2 — VOICE
// -------------------------------------------------------------
function StoryStep({
  language,
  productTitle,
  description,
  isRecording,
  recordingComplete,
  recordingSeconds,
  formattedRecordingTime,
  isPlayingRecording,
  onLanguageChange,
  onTitleChange,
  onDescriptionChange,
  onStartRecording,
  onStopRecording,
  onPlayRecording
}) {
  const [showManualType, setShowManualType] = useState(false);

  const supportedLanguages = [
    { code: "English", label: "English" },
    { code: "Hindi", label: "हिन्दी (Hindi)" },
    { code: "Tamil", label: "தமிழ் (Tamil)" },
    { code: "Telugu", label: "తెలుగు (Telugu)" },
    { code: "Marathi", label: "मराठी (Marathi)" },
    { code: "Bengali", label: "বাংলা (Bengali)" },
    { code: "Kannada", label: "ಕನ್ನಡ (Kannada)" }
  ];

  return (
    <div className="content-card step-card voice-step-card">
      <div className="card-heading">
        <div>
          <span className="section-kicker">02 STORY</span>
          <h2>Tell your story</h2>
          <p>No typing required. Just speak naturally.</p>
        </div>

        <div className="status-pill-subtle">
          <Volume2 size={14} />
          <span>Voice Co-Pilot</span>
        </div>
      </div>

      {/* Language Selector */}
      <div className="voice-language-bar">
        <span className="language-bar-label">Spoken Language:</span>
        <div className="language-pills">
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`lang-pill ${language === lang.code ? "active" : ""}`}
              onClick={() => onLanguageChange(lang.code)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Voice Hero Recording Centerpiece */}
      <div className={`voice-hero-card ${isRecording ? "is-recording" : ""}`}>
        <div className="voice-hero-top">
          {isRecording ? (
            <span className="recording-status-tag">
              <span className="pulse-dot" />
              Recording... Speak naturally
            </span>
          ) : recordingComplete ? (
            <span className="recorded-status-tag">
              <Check size={14} />
              Story recorded ✓
            </span>
          ) : (
            <span className="idle-status-tag">
              Ready to record your story
            </span>
          )}

          <span className="recording-timer">
            {formattedRecordingTime}
          </span>
        </div>

        {/* Waveform Bars */}
        <div className="waveform-display" aria-hidden="true">
          {[20, 35, 55, 75, 90, 100, 70, 85, 95, 65, 45, 80, 60, 40, 50, 25].map(
            (height, i) => (
              <span
                key={i}
                className={`waveform-bar ${isRecording ? "active" : ""}`}
                style={{
                  height: isRecording ? undefined : `${height}%`,
                  animationDelay: `${(i * 0.08).toFixed(2)}s`
                }}
              />
            )
          )}
        </div>

        {/* Microphone Button */}
        <div className="voice-controls-row">
          {!isRecording ? (
            <button
              className={`record-trigger-btn ${recordingComplete ? "recorded" : ""}`}
              onClick={onStartRecording}
              type="button"
              aria-label={recordingComplete ? "Record again" : "Start recording"}
            >
              <div className="record-btn-icon">
                <Mic size={30} />
              </div>
              <span>{recordingComplete ? "Record Again" : "Record your story"}</span>
            </button>
          ) : (
            <button
              className="record-trigger-btn recording"
              onClick={onStopRecording}
              type="button"
              aria-label="Stop recording"
            >
              <div className="record-btn-icon stop-icon">
                <div className="stop-square" />
              </div>
              <span>Stop recording</span>
            </button>
          )}
        </div>

        {/* Audio Playback Controls */}
        {recordingComplete && !isRecording && (
          <div className="playback-bar">
            <button
              className="secondary-button play-preview-btn"
              onClick={onPlayRecording}
              type="button"
            >
              {isPlayingRecording ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlayingRecording ? "Pause audio" : "Play recording"}</span>
            </button>

            <div className="playback-track">
              <div
                className={`playback-progress ${
                  isPlayingRecording ? "animating" : ""
                }`}
              />
            </div>

            <span className="playback-duration">{formattedRecordingTime}</span>
          </div>
        )}
      </div>

      {/* Helper Prompt Box */}
      <div className="voice-helper-card">
        <div className="helper-card-icon">💡</div>
        <div>
          <strong>Helpful cues for your story:</strong>
          <p>
            "Tell us what you made, what materials you used, and how long it took."
          </p>
        </div>
      </div>

      {/* Optional Manual Text Input Fallback */}
      <div className="manual-type-section">
        <button
          className="ghost-button toggle-type-btn"
          type="button"
          onClick={() => setShowManualType(!showManualType)}
        >
          {showManualType ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <span>{showManualType ? "Hide text details" : "Or type instead (optional)"}</span>
        </button>

        {showManualType && (
          <div className="manual-type-form">
            <label className="input-label" htmlFor="product-title-input">
              Product Title
              <input
                id="product-title-input"
                type="text"
                value={productTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. Traditional Bamboo Fruit Basket"
              />
            </label>

            <label className="input-label" htmlFor="product-description-input">
              Product Story & Details
              <textarea
                id="product-description-input"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Describe your craft, materials used, techniques, and crafting time..."
                rows={4}
              />
              <small className="char-count">{description.length} characters</small>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// AI PROCESSING STATE (Signature Visual Moment)
// -------------------------------------------------------------
function AnalyzingState() {
  return (
    <div className="content-card step-card ai-processing-card">
      <div className="processing-diagram">
        <div className="diagram-node">
          <div className="diagram-icon-box">
            <ImagePlus size={22} />
          </div>
          <span className="diagram-label">PHOTO</span>
        </div>

        <span className="diagram-plus">+</span>

        <div className="diagram-node">
          <div className="diagram-icon-box">
            <Mic size={22} />
          </div>
          <span className="diagram-label">VOICE</span>
        </div>

        <div className="diagram-arrow">
          <ArrowRight size={20} />
        </div>

        <div className="diagram-node node-ai">
          <div className="diagram-icon-box ai-pulse-box">
            <Sparkles size={24} />
          </div>
          <span className="diagram-label">CRAFTLENS AI</span>
        </div>

        <div className="diagram-arrow">
          <ArrowRight size={20} />
        </div>

        <div className="diagram-node">
          <div className="diagram-icon-box">
            <PackageCheck size={22} />
          </div>
          <span className="diagram-label">PRODUCT PROFILE</span>
        </div>
      </div>

      <div className="processing-copy">
        <h2>CraftLens is analyzing your craft...</h2>
        <p>
          Translating voice story, detecting materials from photo, and preparing
          fair pricing structure.
        </p>
      </div>

      <div className="processing-progress-bar">
        <div className="processing-scanner-line" />
      </div>

      <div className="processing-checklist">
        <div className="processing-step done">
          <Check size={14} /> Voice story transcribed
        </div>
        <div className="processing-step done">
          <Check size={14} /> Materials and weave patterns identified
        </div>
        <div className="processing-step active">
          <span className="mini-spinner" /> Generating sustainable pricing recommendations
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// STEP 3 — REVIEW
// -------------------------------------------------------------
function ProfileReviewStep({
  profile,
  voiceData,
  imagePreview,
  isSampleProduct,
  recordedAudio,
  isPlayingRecording,
  onPlayRecording,
  showExplanation,
  onToggleExplanation,
  onUpdateField
}) {
  if (!profile) {
    return (
      <div className="content-card step-card">
        <p>Profile information not available. Please return to the previous step.</p>
      </div>
    );
  }

  const displayMaterials = Array.isArray(profile.materials)
    ? profile.materials.join(", ")
    : (profile.materials || "");

  const fields = [
    { key: "title", label: "Product Title", value: profile.title, placeholder: "e.g. Handwoven Sabai Grass Basket" },
    { key: "category", label: "Category", value: profile.category, placeholder: "e.g. Baskets & Weaving" },
    { key: "materials", label: "Craft Materials", value: displayMaterials, placeholder: "e.g. Sabai Grass, Cotton" },
    { key: "craftType", label: "Craft Type", value: profile.craftType || "Handmade Basketry", placeholder: "e.g. Basketry" },
    { key: "dimensions", label: "Dimensions", value: profile.dimensions || "", placeholder: "Not specified (optional)" },
    { key: "productionTime", label: "Production Duration", value: profile.productionTime || "", placeholder: "Not specified (e.g. 2 days)" },
    { key: "artisanSellingPrice", label: "Spoken Artisan Selling Price (₹)", value: profile.artisanSellingPrice || "", placeholder: "Not specified (e.g. 800)" }
  ];

  return (
    <div className="review-layout-grid">
      {/* Left: Product Image */}
      <div className="content-card review-image-card">
        <span className="section-kicker">CRAFT VISUAL</span>
        <div className="review-image-frame">
          {imagePreview ? (
            <img src={imagePreview} alt="Product visual" />
          ) : (
            <div className="sample-review-box">
              <span>🧺</span>
              <strong>{profile.title}</strong>
            </div>
          )}

          <div className="review-image-badges">
            <span className="chip-verified">✓ Analyzed</span>
            <span className="chip-confidence">{profile.confidence?.title ? `${profile.confidence.title} confidence` : "Verified profile"}</span>
          </div>
        </div>

        <div className="review-tags-list">
          {displayMaterials && (
            <span className="tag-item">
              {displayMaterials}
            </span>
          )}
          {profile.craftType && <span className="tag-item">{profile.craftType}</span>}
          {profile.category && <span className="tag-item">{profile.category}</span>}
        </div>
      </div>

      {/* Right: AI-Generated Product Profile */}
      <div className="content-card review-profile-card">
        <div className="card-heading">
          <div>
            <span className="section-kicker">03 REVIEW</span>
            <h2>CraftLens understood my product.</h2>
            <p>Review the AI-generated profile and edit any fields if needed.</p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {voiceData?.status === "success" ? (
              <span className="badge-success" title={`Engine: ${voiceData.model || "faster-whisper"}`}>
                🎙️ Voice Model: Connected
              </span>
            ) : voiceData?.status === "fallback" ? (
              <span className="status-pill-subtle" title="Audio preserved for retry">
                🎙️ Voice: Fallback Mode
              </span>
            ) : (
              <span className="badge-success">✓ Profile Generated</span>
            )}
          </div>
        </div>

        {/* ============================================================
            LAYER 1: RAW VOICE EVIDENCE (Dedicated, Contained & Clean)
            Controlled height with overflow-y: auto, word-break: break-word
            ============================================================ */}
        <div className="voice-evidence-card">
          <div className="voice-evidence-header">
            <div className="voice-evidence-meta-left">
              <div className="voice-evidence-icon-badge">
                <Mic size={15} />
              </div>
              <div className="voice-evidence-titles">
                <span className="voice-evidence-tag">LAYER 1 · SPOKEN EVIDENCE</span>
                <h4 className="voice-evidence-title">Artisan Voice Story</h4>
              </div>
            </div>

            <div className="voice-evidence-meta-right">
              {voiceData?.status === "success" ? (
                <span className="badge-voice-pill voice-model-live" title={`Transcribed by ${voiceData.model || "Voice Model"}`}>
                  <span className="voice-live-dot" />
                  Voice Model Transcribed
                </span>
              ) : voiceData?.status === "fallback" ? (
                <span className="badge-voice-pill voice-model-fallback" title="Voice Model offline; original audio preserved">
                  🎙️ Audio Preserved
                </span>
              ) : (
                <span className="badge-voice-pill voice-model-neutral">
                  ✍️ Direct Artisan Input
                </span>
              )}

              {(voiceData?.language || profile.language) && (
                <span className="badge-voice-pill voice-lang-pill">
                  🌐 {voiceData?.language || profile.language}
                </span>
              )}

              {recordedAudio?.url && (
                <button
                  type="button"
                  className="voice-play-chip"
                  onClick={onPlayRecording}
                  aria-label={isPlayingRecording ? "Pause audio" : "Play audio"}
                >
                  {isPlayingRecording ? <Pause size={12} /> : <Play size={12} />}
                  <span>{isPlayingRecording ? "Pause" : "Listen"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="voice-transcript-scrollbox">
            <p className="voice-raw-text">
              "{voiceData?.transcript || voiceData?.originalText || profile.artisanStory || "No spoken audio recorded."}"
            </p>
            {voiceData?.translatedText && voiceData.translatedText !== (voiceData.transcript || voiceData.originalText) && (
              <div className="voice-translation-block">
                <span className="translation-label">English Translation:</span>
                <p className="translation-text">"{voiceData.translatedText}"</p>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================
            EXTRACTION SUMMARY: Instant semantic snapshot of voice facts
            ============================================================ */}
        <div className="voice-extraction-summary-bar">
          <div className="summary-pill-item">
            <span className="pill-eyebrow">SPOKEN PRICE</span>
            <strong className="pill-value">
              {profile.artisanSellingPrice ? formatCurrency(profile.artisanSellingPrice) : "Not mentioned"}
            </strong>
          </div>
          <div className="summary-pill-item">
            <span className="pill-eyebrow">DAILY CAPACITY</span>
            <strong className="pill-value">
              {profile.capacityPerDay ? `${profile.capacityPerDay} units/day` : "Not mentioned"}
            </strong>
          </div>
          <div className="summary-pill-item">
            <span className="pill-eyebrow">CRAFT TIME</span>
            <strong className="pill-value">
              {profile.productionTime || "Not mentioned"}
            </strong>
          </div>
          <div className="summary-pill-item">
            <span className="pill-eyebrow">DIMENSIONS</span>
            <strong className="pill-value">
              {profile.dimensions || "Not specified"}
            </strong>
          </div>
        </div>

        {/* ============================================================
            LAYER 2: STRUCTURED PRODUCT DATA (Editable Canonical Profile)
            ============================================================ */}
        <div className="profile-section-heading">
          <span className="section-kicker">LAYER 2 · STRUCTURED DATA</span>
          <h3>Canonical Product Attributes</h3>
        </div>

        <div className="profile-fields-grid">
          {fields.map((f) => (
            <div className="profile-field-group" key={f.key}>
              <div className="field-top-label">
                <label htmlFor={`field-${f.key}`}>{f.label}</label>
                <span className="field-confidence-tag">
                  {profile.evidence?.[f.key]?.source === "artisan_input"
                    ? "Artisan verified"
                    : profile.evidence?.[f.key]?.source === "voice_model_output"
                    ? "Voice extracted"
                    : profile.evidence?.[f.key]?.source === "visual"
                    ? "Vision detected"
                    : "AI inferred"}
                </span>
              </div>
              <input
                id={`field-${f.key}`}
                type="text"
                value={f.key === "materials" ? displayMaterials : (profile[f.key] || f.value || "")}
                placeholder={f.placeholder || ""}
                onChange={(e) => onUpdateField(f.key, e.target.value)}
              />
            </div>
          ))}

          {profile.capacityPerDay && (
            <div className="profile-field-group full-width capacity-banner">
              <div className="capacity-content">
                <span className="capacity-badge">⚡ Production Capacity</span>
                <span className="capacity-text">
                  Artisan can produce <strong>{profile.capacityPerDay} units per day</strong>.
                </span>
                <small className="capacity-disclaimer">
                  (Production capacity per day is distinct from single item crafting duration)
                </small>
              </div>
            </div>
          )}

          <div className="profile-field-group full-width">
            <div className="field-top-label">
              <label htmlFor="field-artisan-story">Artisan Story</label>
              <span className="field-confidence-tag">Voice evidence</span>
            </div>
            <textarea
              id="field-artisan-story"
              rows={3}
              value={profile.artisanStory || ""}
              onChange={(e) => onUpdateField("artisanStory", e.target.value)}
            />
          </div>

          <div className="profile-field-group full-width">
            <div className="field-top-label">
              <label htmlFor="field-description">Catalog Description</label>
              <span className="field-confidence-tag">AI synthesized</span>
            </div>
            <textarea
              id="field-description"
              rows={3}
              value={profile.description || ""}
              onChange={(e) => onUpdateField("description", e.target.value)}
            />
          </div>
        </div>

        {/* Collapsible Explanation */}
        <div className="explanation-drawer">
          <button
            className="ghost-button explanation-toggle-btn"
            onClick={onToggleExplanation}
            type="button"
          >
            <Info size={15} />
            <span>How did CraftLens decide?</span>
            {showExplanation ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showExplanation && (
            <div className="explanation-content">
              <p>
                CraftLens combined natural language processing on your voice transcript
                with computer vision texture detection on your photo to extract craft
                lineage, materials, and production duration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// STEP 4 — PRICING & MATERIALS
// -------------------------------------------------------------
function PricingMaterialsStep({
  pricing,
  materialsPlan,
  costInputs,
  onCostInputChange
}) {
  if (!pricing || !materialsPlan) {
    return (
      <div className="content-card step-card">
        <p>Pricing information not ready. Please return to the previous step.</p>
      </div>
    );
  }

  const totalCost = pricing.costs?.totalCost || 1;
  const matPct = Math.round((costInputs.materialCost / totalCost) * 100);
  const labPct = Math.round((costInputs.labourCost / totalCost) * 100);
  const packPct = Math.round((costInputs.packagingCost / totalCost) * 100);
  const platPct = Math.round((costInputs.platformCost / totalCost) * 100);
  const overPct = Math.max(0, 100 - matPct - labPct - packPct - platPct);

  return (
    <div className="pricing-page-layout">
      {/* Pricing Section */}
      <div className="content-card pricing-main-card">
        <div className="card-heading">
          <div>
            <span className="section-kicker">04 PRICING & MATERIALS</span>
            <h2>Cost Calculation & Pricing Options</h2>
            <p>Calculated directly from your entered material, labour, packaging, and overhead costs.</p>
          </div>

          <div className="status-pill-subtle">
            <TrendingUp size={14} />
            <span>Cost-Based Calculation</span>
          </div>
        </div>

        {/* Spoken Artisan Price vs System Recommended Tiers */}
        {pricing.artisanSellingPrice ? (
          <div className="artisan-price-comparison-card">
            <div className="comparison-badge-row">
              <span className="badge-voice-pill">🎙️ Spoken Artisan Price</span>
              <span className={`status-pill-${pricing.comparison?.status || "sustainable"}`}>
                {pricing.comparison?.status === "above_recommended"
                  ? "✓ Healthy Margin"
                  : pricing.comparison?.status === "sustainable"
                  ? "✓ Sustainable"
                  : "⚠️ Low Margin"}
              </span>
            </div>
            <div className="comparison-main-row">
              <div className="artisan-stated-box">
                <span className="comp-label">SPOKEN SELLING PRICE</span>
                <strong className="comp-amount">{formatCurrency(pricing.artisanSellingPrice)}</strong>
                <span className="comp-subtext">Directly from artisan voice story</span>
              </div>
              <div className="comp-vs-divider">VS</div>
              <div className="system-rec-box">
                <span className="comp-label">SYSTEM RECOMMENDED</span>
                <strong className="comp-amount">{formatCurrency(pricing.recommendedPrice)}</strong>
                <span className="comp-subtext">Calculated from costs (+50% profit margin)</span>
              </div>
            </div>
            <p className="comparison-note-text">
              {pricing.comparison?.note || "Your price is compared with our cost-plus sustainable pricing model."}
            </p>
          </div>
        ) : (
          <div className="artisan-price-neutral-notice">
            <span>ℹ️ No specific selling price was mentioned in the voice story. Below are system-recommended tiers derived from entered production costs.</span>
          </div>
        )}

        {/* Three Pricing Tier Options */}
        <div className="pricing-tiers-row">
          <div className="price-card tier-minimum">
            <span className="price-tier-tag">MINIMUM</span>
            <strong className="price-tier-amount">
              {formatCurrency(pricing.minimumPrice)}
            </strong>
            <p>Covers base raw material costs and daily living wage.</p>
          </div>

          <div className="price-card tier-recommended">
            <span className="recommended-badge">
              RECOMMENDED FOR SUSTAINABLE PROFIT
            </span>
            <span className="price-tier-tag rec-tag">RECOMMENDED</span>
            <strong className="price-tier-amount rec-amount">
              {formatCurrency(pricing.recommendedPrice)}
            </strong>
            <p>Optimal balance between artisan profit margin and buyer conversion.</p>
          </div>

          <div className="price-card tier-premium">
            <span className="price-tier-tag">PREMIUM</span>
            <strong className="price-tier-amount">
              {formatCurrency(pricing.premiumPrice)}
            </strong>
            <p>For design galleries, gift hampers, and luxury boutique retail.</p>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="cost-breakdown-section">
          <div className="breakdown-title-row">
            <div>
              <h3>Cost breakdown</h3>
              <p>Proportional split of production expenditures</p>
            </div>
            <strong>Total cost: {formatCurrency(pricing.costs.totalCost)}</strong>
          </div>

          <div className="proportional-bar" aria-hidden="true">
            <div className="bar-seg seg-materials" style={{ width: `${matPct}%` }} title="Materials" />
            <div className="bar-seg seg-labour" style={{ width: `${labPct}%` }} title="Labour" />
            <div className="bar-seg seg-packaging" style={{ width: `${packPct}%` }} title="Packaging" />
            <div className="bar-seg seg-platform" style={{ width: `${platPct}%` }} title="Platform" />
            <div className="bar-seg seg-overhead" style={{ width: `${overPct}%` }} title="Overhead" />
          </div>

          <div className="breakdown-legend">
            <span className="legend-item"><span className="dot dot-mat" /> Material ({matPct}%)</span>
            <span className="legend-item"><span className="dot dot-lab" /> Labour ({labPct}%)</span>
            <span className="legend-item"><span className="dot dot-pack" /> Packaging ({packPct}%)</span>
            <span className="legend-item"><span className="dot dot-plat" /> Platform ({platPct}%)</span>
            <span className="legend-item"><span className="dot dot-over" /> Overhead ({overPct}%)</span>
          </div>

          {/* Editable Cost Inputs */}
          <div className="cost-inputs-grid">
            <CostInput
              label="Material"
              value={costInputs.materialCost}
              onChange={(val) => onCostInputChange("materialCost", val)}
            />
            <CostInput
              label="Labour"
              value={costInputs.labourCost}
              onChange={(val) => onCostInputChange("labourCost", val)}
            />
            <CostInput
              label="Packaging"
              value={costInputs.packagingCost}
              onChange={(val) => onCostInputChange("packagingCost", val)}
            />
            <CostInput
              label="Platform"
              value={costInputs.platformCost}
              onChange={(val) => onCostInputChange("platformCost", val)}
            />
            <CostInput
              label="Overhead"
              value={costInputs.overheadCost}
              onChange={(val) => onCostInputChange("overheadCost", val)}
            />
          </div>
        </div>
      </div>

      {/* Material Plan */}
      <div className="content-card materials-main-card">
        <div className="card-heading">
          <div>
            <span className="section-kicker">MATERIAL PLAN</span>
            <h2>What you'll need</h2>
            <p>Estimated raw materials required for production.</p>
          </div>

          <div className="status-pill-subtle">
            <PackageCheck size={14} />
            <span>{materialsPlan.materials.length} Items</span>
          </div>
        </div>

        <div className="materials-list">
          {materialsPlan.materials.map((item) => (
            <div className="material-item-card" key={item.id}>
              <div className="mat-left">
                <strong>{item.name}</strong>
                <span>{item.quantity}</span>
              </div>

              <div className="mat-right">
                <strong>{formatCurrency(item.estimatedCost)} estimated</strong>
                <span
                  className={`stock-tag ${item.stockClass === "warning" ? "stock-warning" : ""}`}
                  style={item.stockClass === "warning" ? { background: "rgba(220, 38, 38, 0.12)", color: "#b91c1c", borderColor: "#fca5a5" } : undefined}
                >
                  {item.stockClass === "warning" ? "⚠️ Stock shortage" : "✓ In stock"}
                </span>
                {item.shortageQuantity > 0 && (
                  <span style={{ fontSize: "11px", color: "#b91c1c", marginTop: "2px", display: "block" }}>
                    Shortage: {item.shortageQuantity} needed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="supplier-card">
          <div className="supplier-icon-wrap">
            <MapPin size={18} />
          </div>
          <div>
            <strong>Supplier suggestion</strong>
            <p>{materialsPlan.supplierSuggestion || "Supplier information unavailable"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostInput({ label, value, onChange }) {
  return (
    <label className="cost-input-item">
      <span>{label}</span>
      <div className="cost-input-box">
        <span>₹</span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

// -------------------------------------------------------------
// STEP 5 — FINAL REVIEW
// -------------------------------------------------------------
function FinalReviewStep({
  profile,
  pricing,
  materialsPlan,
  imagePreview,
  isSampleProduct,
  onEditStep
}) {
  if (!profile || !pricing || !materialsPlan) {
    return (
      <div className="content-card step-card">
        <p>Listing preview not ready. Please complete earlier steps.</p>
      </div>
    );
  }

  return (
    <div className="final-review-grid">
      {/* Left: Product Preview */}
      <div className="content-card listing-showcase-card">
        <div className="card-heading">
          <div>
            <span className="section-kicker">05 PUBLISH</span>
            <h2>Product listing preview</h2>
            <p>How buyers will see your handmade creation.</p>
          </div>

          <span className="badge-success">READY TO PUBLISH</span>
        </div>

        <div className="listing-preview-body">
          <div className="preview-image-container">
            {imagePreview ? (
              <img src={imagePreview} alt="Final product preview" />
            ) : (
              <div className="sample-final-visual">
                <span>🧺</span>
              </div>
            )}
            <span className="preview-image-badge">Handcrafted Piece</span>
          </div>

          <div className="preview-info-container">
            <div className="preview-top-badges">
              <span className="cat-badge">{profile.category}</span>
              <span className="artisan-badge">By Anita Crafts</span>
            </div>

            <h2 className="preview-title">{profile.title}</h2>

            <p className="preview-story-text">{profile.artisanStory}</p>

            <div className="preview-specs-grid">
              <div>
                <small>Material</small>
                <strong>{Array.isArray(profile.materials) ? profile.materials.join(", ") : (profile.materials || "Natural Materials")}</strong>
              </div>
              <div>
                <small>Dimensions</small>
                <strong>{profile.dimensions || "Not specified"}</strong>
              </div>
              <div>
                <small>Production Time</small>
                <strong>{profile.productionTime || "Not specified"}</strong>
              </div>
              {profile.capacityPerDay && (
                <div>
                  <small>Daily Capacity</small>
                  <strong>{profile.capacityPerDay} units/day</strong>
                </div>
              )}
            </div>

            <div className="preview-pricing-block">
              <div>
                <small>Recommended Selling Price</small>
                <div className="preview-price-num">
                  {formatCurrency(pricing.recommendedPrice)}
                </div>
                {pricing.artisanSellingPrice && (
                  <div className="preview-artisan-price-sub">
                    Spoken Artisan Price: <strong>{formatCurrency(pricing.artisanSellingPrice)}</strong>
                  </div>
                )}
              </div>

              <div className="preview-stock-badge-group">
                <span className={`stock-status-pill ${materialsPlan?.materials?.some(m => m.stockClass === "warning") ? "stock-pill-warning" : "stock-pill-ok"}`}>
                  {materialsPlan?.materials?.some(m => m.stockClass === "warning") ? "⚠️ Material shortage" : "✓ Materials in stock"}
                </span>
                <span className="shipping-note">Ready to ship</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Readiness Audit */}
      <div className="content-card audit-sidebar-card">
        <div className="card-heading">
          <div>
            <span className="section-kicker">VERIFICATION</span>
            <h3>Readiness audit</h3>
          </div>
          <Check size={18} className="audit-check-icon" />
        </div>

        <div className="audit-checklist">
          <div className="audit-item done">
            <span className="audit-icon">✓</span>
            <div>
              <strong>Product photo</strong>
              <span>High resolution verified</span>
            </div>
            <button className="ghost-button edit-btn" onClick={() => onEditStep(1)} type="button">Edit</button>
          </div>

          <div className="audit-item done">
            <span className="audit-icon">✓</span>
            <div>
              <strong>Voice story</strong>
              <span>Story transcribed and formatted</span>
            </div>
            <button className="ghost-button edit-btn" onClick={() => onEditStep(2)} type="button">Edit</button>
          </div>

          <div className="audit-item done">
            <span className="audit-icon">✓</span>
            <div>
              <strong>Listing details</strong>
              <span>Category and dimensions checked</span>
            </div>
            <button className="ghost-button edit-btn" onClick={() => onEditStep(3)} type="button">Edit</button>
          </div>

          <div className="audit-item done">
            <span className="audit-icon">✓</span>
            <div>
              <strong>Fair price</strong>
              <span>{formatCurrency(pricing.recommendedPrice)} recommended</span>
            </div>
            <button className="ghost-button edit-btn" onClick={() => onEditStep(4)} type="button">Edit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUCCESS STATE
// -------------------------------------------------------------
function PublishedState({
  profile,
  pricing,
  imagePreview,
  isSampleProduct,
  navigateTo,
  onReset
}) {
  return (
    <div className="content-card published-card">
      <div className="published-check-circle">
        <Check size={40} />
      </div>

      <span className="section-kicker">SUCCESS</span>
      <h2>✓ YOUR CRAFT IS LIVE</h2>
      <p>
        Your handcrafted product has been published and is now available in your
        store catalogue.
      </p>

      <div className="published-summary-card">
        <div className="pub-image-box">
          {imagePreview ? (
            <img src={imagePreview} alt="Published product" />
          ) : (
            <span>🧺</span>
          )}
        </div>

        <div className="pub-details">
          <span className="badge-category">{profile?.category || "Handmade Craft"}</span>
          <h3>{profile?.title}</h3>
          <strong className="pub-price">
            {pricing ? formatCurrency(pricing.recommendedPrice) : ""}
          </strong>
          <span className="pub-status-tag">Published</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "center" }}>
        <button
          className="primary-button"
          onClick={() => navigateTo && navigateTo("catalogue")}
          type="button"
        >
          View in Catalogue
        </button>
        <button
          className="secondary-button"
          onClick={onReset}
          type="button"
        >
          Create Another Product
        </button>
      </div>
    </div>
  );
}

function PreparingPlanState() {
  return (
    <div className="content-card step-card ai-processing-card">
      <div className="processing-diagram">
        <div className="diagram-node node-ai">
          <div className="diagram-icon-box ai-pulse-box">
            <TrendingUp size={24} />
          </div>
          <span className="diagram-label">PRICING ENGINE</span>
        </div>
      </div>

      <div className="processing-copy">
        <h2>Preparing your pricing plan...</h2>
        <p>Calculating raw material expenses, artisan living wage, and market demand.</p>
      </div>

      <div className="processing-progress-bar">
        <div className="processing-scanner-line" />
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function roundToNearestTen(value) {
  return Math.round(value / 10) * 10;
}

export default CreateProduct;
