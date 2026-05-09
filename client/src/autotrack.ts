import type { AnalyticsClient, EventProperties, JsonValue } from "./index";

export const DEFAULT_CLICK_SELECTORS = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
] as const;

export interface ClickAutotrackOptions {
  client: Pick<AnalyticsClient, "send">;
  eventType?: string;
  selectors?: readonly string[];
  sessionId?: string | (() => string | undefined);
  personId?: string | (() => string | undefined);
  document?: Document;
  capture?: boolean;
  includeText?: boolean;
  maxPathDepth?: number;
  maxAttributeLength?: number;
  onError?: (error: unknown) => void;
}

export interface ClickAutotrackHandle {
  stop(): void;
}

export function enableClickAutotracking(options: ClickAutotrackOptions): ClickAutotrackHandle {
  const doc = options.document ?? globalThis.document;
  if (!doc) {
    throw new Error("document is not available; click autotracking requires a DOM runtime");
  }

  const selectors = options.selectors ?? DEFAULT_CLICK_SELECTORS;
  const selector = selectors.join(",");
  const maxPathDepth = options.maxPathDepth ?? 8;
  const maxAttributeLength = options.maxAttributeLength ?? 256;
  const includeText = options.includeText ?? false;

  const listener = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof doc.defaultView!.Element)) {
      return;
    }

    const element = target.closest(selector);
    if (!element) {
      return;
    }

    const properties = buildClickProperties(element, {
      document: doc,
      maxPathDepth,
      maxAttributeLength,
      includeText,
    });

    const sessionId = resolveIdentity(options.sessionId);
    const personId = resolveIdentity(options.personId);
    const payload = {
      eventType: options.eventType ?? "$autoclick",
      properties,
    };

    void options.client
      .send({
        ...payload,
        ...(sessionId ? { sessionId } : {}),
        ...(personId ? { personId } : {}),
      })
      .catch((error) => options.onError?.(error));
  };

  doc.addEventListener("click", listener, { capture: options.capture ?? true });

  return {
    stop() {
      doc.removeEventListener("click", listener, { capture: options.capture ?? true });
    },
  };
}

interface BuildClickPropertiesOptions {
  document: Document;
  maxPathDepth: number;
  maxAttributeLength: number;
  includeText: boolean;
}

function buildClickProperties(element: Element, options: BuildClickPropertiesOptions): EventProperties {
  const htmlElement = element instanceof options.document.defaultView!.HTMLElement ? element : null;
  const attributes = collectAttributes(element, options.maxAttributeLength);
  const properties: EventProperties = {
    tagName: element.tagName.toLowerCase(),
    domPath: buildDomPath(element, options.maxPathDepth),
    attributes,
  };

  if (htmlElement?.id) {
    properties.id = htmlElement.id;
  }
  if (htmlElement?.className && typeof htmlElement.className === "string") {
    properties.className = truncate(htmlElement.className, options.maxAttributeLength);
  }
  if (htmlElement?.getAttribute("role")) {
    properties.role = htmlElement.getAttribute("role");
  }
  if (element instanceof options.document.defaultView!.HTMLAnchorElement && element.href) {
    properties.href = element.href;
  }
  if (element instanceof options.document.defaultView!.HTMLInputElement) {
    properties.inputType = element.type;
    properties.checked = element.checked;
  }
  if (options.includeText) {
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    if (text) {
      properties.text = truncate(text, options.maxAttributeLength);
    }
  }

  return properties;
}

function collectAttributes(element: Element, maxLength: number): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const attribute of Array.from(element.attributes)) {
    if (shouldSkipAttribute(attribute.name)) {
      continue;
    }
    result[attribute.name] = truncate(attribute.value, maxLength);
  }
  return result;
}

function shouldSkipAttribute(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized === "value" || normalized === "style";
}

function buildDomPath(element: Element, maxDepth: number): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && parts.length < maxDepth) {
    parts.unshift(buildPathPart(current));
    if (current.id) {
      break;
    }
    current = current.parentElement;
  }

  return parts.join(" > ");
}

function buildPathPart(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  if (element.id) {
    return `${tagName}#${cssEscape(element.id)}`;
  }

  const classNames = getClassNames(element);
  const classSuffix = classNames.length > 0 ? `.${classNames.map(cssEscape).join(".")}` : "";
  const index = siblingIndex(element);
  return `${tagName}${classSuffix}:nth-of-type(${index})`;
}

function getClassNames(element: Element): string[] {
  return Array.from(element.classList).filter(Boolean).slice(0, 4);
}

function siblingIndex(element: Element): number {
  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape;
  if (escape) {
    return escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function resolveIdentity(value: string | (() => string | undefined) | undefined): string | undefined {
  if (typeof value === "function") {
    return value();
  }
  return value;
}
