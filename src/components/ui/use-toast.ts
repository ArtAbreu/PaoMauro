"use client";

import * as React from "react";
import type { ToastProps, ToastActionElement } from "./toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

type ActionType = typeof actionTypes;

let count = 0;

function genId() {
  count += 1;
  return `toast-${count}`;
}

type State = {
  toasts: ToasterToast[];
};

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const [state, dispatch] = React.useReducer(
  (state: State, action: { type: ActionType[keyof ActionType]; toast?: ToasterToast; toastId?: string }) => {
    switch (action.type) {
      case actionTypes.ADD_TOAST:
        return {
          ...state,
          toasts: [action.toast!, ...state.toasts].slice(0, TOAST_LIMIT),
        };
      case actionTypes.UPDATE_TOAST:
        return {
          ...state,
          toasts: state.toasts.map((t) => (t.id === action.toast!.id ? { ...t, ...action.toast } : t)),
        };
      case actionTypes.DISMISS_TOAST: {
        const { toastId } = action;
        if (toastId) {
          toastTimeouts.set(
            toastId,
            setTimeout(() => dispatch({ type: actionTypes.REMOVE_TOAST, toastId }), TOAST_REMOVE_DELAY)
          );
        }

        return {
          ...state,
          toasts: state.toasts.map((t) =>
            t.id === toastId || toastId === undefined
              ? {
                  ...t,
                  open: false,
                }
              : t
          ),
        };
      }
      case actionTypes.REMOVE_TOAST:
        if (!action.toastId) {
          return {
            ...state,
            toasts: [],
          };
        }
        return {
          ...state,
          toasts: state.toasts.filter((t) => t.id !== action.toastId),
        };
      default:
        return state;
    }
  },
  { toasts: [] }
);

const listeners = new Set<(state: State) => void>();

function dispatchToasts(action: Parameters<typeof dispatch>[0]) {
  dispatch(action);
  listeners.forEach((listener) => {
    listener(state);
  });
}

function addToast(toast: ToasterToast) {
  dispatchToasts({ type: actionTypes.ADD_TOAST, toast });
}

function updateToast(toast: ToasterToast) {
  dispatchToasts({ type: actionTypes.UPDATE_TOAST, toast });
}

function dismissToast(toastId?: string) {
  dispatchToasts({ type: actionTypes.DISMISS_TOAST, toastId });
}

interface Toast extends Omit<ToasterToast, "id"> {}

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) => updateToast({ ...props, id });
  const dismiss = () => dismissToast(id);

  addToast({ ...props, id, open: true });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [localState, setLocalState] = React.useState<State>(state);

  React.useEffect(() => {
    listeners.add(setLocalState);
    return () => {
      listeners.delete(setLocalState);
    };
  }, []);

  return {
    ...localState,
    toast,
    dismiss: dismissToast,
  };
}

export { useToast, toast };
