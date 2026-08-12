import React, {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  isAppCameraCaptureAvailable,
  type AppCameraCapturePayload,
} from '../components/camera/appCameraCaptureTypes';

const AppCameraCaptureOverlay = lazy(() =>
  import('../components/camera/AppCameraCaptureOverlay').then((m) => ({
    default: m.AppCameraCaptureOverlay,
  })),
);

export type OpenAppCameraOptions = {
  title?: string;
  onCaptured: (payload: AppCameraCapturePayload) => void | Promise<void>;
  onClose?: () => void;
};

export type { AppCameraCapturePayload };

type AppCameraContextValue = {
  isAvailable: boolean;
  isOpen: boolean;
  openCamera: (options: OpenAppCameraOptions) => void;
  closeCamera: () => void;
};

const AppCameraContext = createContext<AppCameraContextValue | null>(null);

export function AppCameraProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Camera');
  const optionsRef = useRef<OpenAppCameraOptions | null>(null);

  const closeCamera = useCallback(() => {
    setOpen(false);
    optionsRef.current?.onClose?.();
    optionsRef.current = null;
  }, []);

  const openCamera = useCallback((options: OpenAppCameraOptions) => {
    if (!isAppCameraCaptureAvailable()) return;
    optionsRef.current = options;
    setTitle(options.title ?? 'Camera');
    setOpen(true);
  }, []);

  const handleCaptured = useCallback(async (payload: AppCameraCapturePayload) => {
    const handler = optionsRef.current?.onCaptured;
    optionsRef.current = null;
    setOpen(false);
    await handler?.(payload);
  }, []);

  return (
    <AppCameraContext.Provider
      value={{
        isAvailable: isAppCameraCaptureAvailable(),
        isOpen: open,
        openCamera,
        closeCamera,
      }}
    >
      {children}
      {open ? (
        <Suspense fallback={null}>
          <AppCameraCaptureOverlay
            open={open}
            onClose={closeCamera}
            title={title}
            onCaptured={(payload) => {
              void handleCaptured(payload);
            }}
          />
        </Suspense>
      ) : null}
    </AppCameraContext.Provider>
  );
}

const APP_CAMERA_UNAVAILABLE: AppCameraContextValue = {
  isAvailable: false,
  isOpen: false,
  openCamera: () => {},
  closeCamera: () => {},
};

export function useAppCamera(): AppCameraContextValue {
  const ctx = useContext(AppCameraContext);
  return ctx ?? APP_CAMERA_UNAVAILABLE;
}

/** Safe when a screen may mount outside the main shell provider tree. */
export function useAppCameraOptional(): AppCameraContextValue | null {
  return useContext(AppCameraContext);
}

export { isAppCameraCaptureAvailable };
