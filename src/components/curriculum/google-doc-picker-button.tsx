"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";

const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
const PICKER_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_PICKER_APP_ID;
const PICKER_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const PICKER_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

type TokenResponse = {
  access_token?: string;
  error?: string;
};

type TokenClient = {
  callback: (response: TokenResponse) => void;
  requestAccessToken: (options: { prompt?: "" | "consent" }) => void;
};

type PickerDocument = Record<string, unknown>;

type PickerResponse = {
  action?: string;
} & Record<string, unknown>;

type PickerApi = {
  Action: { PICKED: string };
  Document: { ID: string; NAME: string; URL: string };
  Feature: { NAV_HIDDEN: string };
  Response: { DOCUMENTS: string };
  ViewId: { DOCS: string };
  View: new (viewId: string) => { setMimeTypes: (mimeTypes: string) => void };
  PickerBuilder: new () => {
    addView: (view: unknown) => PickerBuilderShape;
    enableFeature: (feature: string) => PickerBuilderShape;
    setAppId: (appId: string) => PickerBuilderShape;
    setCallback: (callback: (data: PickerResponse) => void) => PickerBuilderShape;
    setDeveloperKey: (key: string) => PickerBuilderShape;
    setOAuthToken: (token: string) => PickerBuilderShape;
  };
};

type PickerBuilderShape = {
  addView: (view: unknown) => PickerBuilderShape;
  build: () => { setVisible: (visible: boolean) => void };
  enableFeature: (feature: string) => PickerBuilderShape;
  setAppId: (appId: string) => PickerBuilderShape;
  setCallback: (callback: (data: PickerResponse) => void) => PickerBuilderShape;
  setDeveloperKey: (key: string) => PickerBuilderShape;
  setOAuthToken: (token: string) => PickerBuilderShape;
};

declare global {
  interface Window {
    gapi?: {
      load: (library: string, callback: () => void) => void;
    };
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
      picker?: PickerApi;
    };
  }
}

export type GoogleDocPickerSelection = {
  documentId: string;
  title?: string;
  url?: string;
};

export function GoogleDocPickerButton({
  className,
  disabled,
  onPicked,
}: {
  className?: string;
  disabled?: boolean;
  onPicked: (selection: GoogleDocPickerSelection) => void;
}) {
  const tokenClientRef = useRef<TokenClient | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const configured = Boolean(
    PICKER_API_KEY && PICKER_APP_ID && PICKER_CLIENT_ID,
  );
  const [state, setState] = useState<
    "missing" | "loading" | "ready" | "error" | "authorizing"
  >(configured ? "loading" : "missing");

  useEffect(() => {
    if (!configured) return;

    let mounted = true;
    Promise.all([
      loadScript("google-api-loader", "https://apis.google.com/js/api.js"),
      loadScript("google-identity", "https://accounts.google.com/gsi/client"),
    ])
      .then(() => {
        if (!mounted) return;
        window.gapi?.load("picker", () => {
          if (!mounted) return;
          const tokenClient =
            window.google?.accounts?.oauth2?.initTokenClient({
              client_id: PICKER_CLIENT_ID!,
              scope: PICKER_SCOPE,
              callback: () => undefined,
            });
          if (!tokenClient || !window.google?.picker) {
            setState("error");
            return;
          }
          tokenClientRef.current = tokenClient;
          setState("ready");
        });
      })
      .catch(() => {
        if (mounted) setState("error");
      });

    return () => {
      mounted = false;
    };
  }, [configured]);

  if (state === "missing") return null;

  function openPicker() {
    const tokenClient = tokenClientRef.current;
    if (!tokenClient || !window.google?.picker) {
      setState("error");
      return;
    }

    setState("authorizing");
    tokenClient.callback = (response) => {
      if (response.error || !response.access_token) {
        setState("error");
        return;
      }
      accessTokenRef.current = response.access_token;
      showPicker(response.access_token);
    };
    tokenClient.requestAccessToken({
      prompt: accessTokenRef.current ? "" : "consent",
    });
  }

  function showPicker(accessToken: string) {
    const pickerApi = window.google?.picker;
    if (!pickerApi || !PICKER_API_KEY || !PICKER_APP_ID) {
      setState("error");
      return;
    }

    const docsView = new pickerApi.View(pickerApi.ViewId.DOCS);
    docsView.setMimeTypes(GOOGLE_DOC_MIME_TYPE);

    const picker = new pickerApi.PickerBuilder()
      .enableFeature(pickerApi.Feature.NAV_HIDDEN)
      .setDeveloperKey(PICKER_API_KEY)
      .setAppId(PICKER_APP_ID)
      .setOAuthToken(accessToken)
      .addView(docsView)
      .setCallback((data) => {
        if (data.action !== pickerApi.Action.PICKED) {
          setState("ready");
          return;
        }

        const docs = data[pickerApi.Response.DOCUMENTS];
        const document = Array.isArray(docs)
          ? (docs[0] as PickerDocument | undefined)
          : undefined;
        const documentId = readPickerString(
          document?.[pickerApi.Document.ID],
        );
        if (!documentId) {
          setState("error");
          return;
        }

        onPicked({
          documentId,
          title: readPickerString(document?.[pickerApi.Document.NAME]),
          url: readPickerString(document?.[pickerApi.Document.URL]),
        });
        setState("ready");
      })
      .build();

    picker.setVisible(true);
  }

  const label =
    state === "loading"
      ? "Loading Picker"
      : state === "authorizing"
        ? "Opening Picker"
        : state === "error"
          ? "Picker unavailable"
          : "Choose from Drive";

  return (
    <button
      type="button"
      disabled={disabled || state !== "ready"}
      onClick={openPicker}
      className={className}
    >
      <FolderOpen className="h-4 w-4" />
      {label}
    </button>
  );
}

function readPickerString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function loadScript(id: string, src: string) {
  if (document.getElementById(id)) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(src)), {
      once: true,
    });
    document.head.appendChild(script);
  });
}
