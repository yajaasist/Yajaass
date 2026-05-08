const isNode = typeof window === "undefined";

type AppParamOptions = {
  defaultValue?: string;
  removeFromUrl?: boolean;
};

const toSnakeCase = (str: string) => str.replace(/([A-Z])/g, "_$1").toLowerCase();

const getStorage = (): Storage | null => {
  if (isNode) return null;
  return window.localStorage;
};

const getEnv = (key: string): string | undefined => {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
};

export const getAppParamValue = (
  paramName: string,
  { defaultValue, removeFromUrl = false }: AppParamOptions = {},
): string | null | undefined => {
  if (isNode) {
    return defaultValue;
  }

  const storage = getStorage();
  const storageKey = `base44_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (searchParam) {
    storage?.setItem(storageKey, searchParam);
    return searchParam;
  }

  if (defaultValue) {
    storage?.setItem(storageKey, defaultValue);
    return defaultValue;
  }

  const storedValue = storage?.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }

  return null;
};

export const getAppParams = () => {
  const storage = getStorage();

  if (getAppParamValue("clear_access_token") === "true") {
    storage?.removeItem("base44_access_token");
    storage?.removeItem("token");
  }

  return {
    appId: getAppParamValue("app_id", {
      defaultValue: getEnv("NEXT_PUBLIC_BASE44_APP_ID"),
    }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", {
      defaultValue: isNode ? undefined : window.location.href,
    }),
    functionsVersion: getAppParamValue("functions_version", {
      defaultValue: getEnv("NEXT_PUBLIC_BASE44_FUNCTIONS_VERSION"),
    }),
    appBaseUrl: getAppParamValue("app_base_url", {
      defaultValue: getEnv("NEXT_PUBLIC_BASE44_APP_BASE_URL"),
    }),
  };
};

export const appParams = {
  ...getAppParams(),
};
