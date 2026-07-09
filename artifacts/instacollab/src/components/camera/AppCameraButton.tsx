import { Camera } from 'lucide-react';
import {
  useAppCameraOptional,
  type AppCameraCapturePayload,
} from '../../contexts/AppCameraContext';

export type AppCameraButtonProps = {
  title?: string;
  onCaptured: (payload: AppCameraCapturePayload) => void | Promise<void>;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
  label?: string;
  'aria-label'?: string;
};

/** Opens the global UniLive camera overlay when capture is available. */
export function AppCameraButton({
  title,
  onCaptured,
  className,
  iconClassName = 'w-4 h-4',
  disabled = false,
  label,
  'aria-label': ariaLabel,
}: AppCameraButtonProps) {
  const camera = useAppCameraOptional();
  if (!camera?.isAvailable) return null;
  const { openCamera } = camera;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? label ?? 'Open camera'}
      onClick={() =>
        openCamera({
          title: title ?? 'Camera',
          onCaptured: (payload) => {
            void onCaptured(payload);
          },
        })
      }
      className={className}
    >
      <Camera className={iconClassName} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
