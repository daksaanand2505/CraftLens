import { Check } from "lucide-react";

function ProgressStepper({ steps, currentStep }) {
  return (
    <nav className="progress-stepper" aria-label="Product creation progress">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const formattedNum = String(stepNumber).padStart(2, "0");
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div className="step-wrapper" key={step}>
            <div
              className={[
                "step-item",
                isCompleted ? "completed" : "",
                isCurrent ? "current" : "",
                stepNumber > currentStep ? "upcoming" : ""
              ].filter(Boolean).join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="step-indicator" aria-hidden="true">
                {isCompleted ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : (
                  <span>{formattedNum}</span>
                )}
              </div>

              <div className="step-text-wrap">
                <span className="step-number-label">{formattedNum}</span>
                <span className="step-title">{step}</span>
              </div>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`step-line ${
                  isCompleted ? "step-line-completed" : ""
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default ProgressStepper;
