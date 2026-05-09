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
];
export function enableClickAutotracking(options) {
    const doc = options.document ?? globalThis.document;
    if (!doc) {
        throw new Error("document is not available; click autotracking requires a DOM runtime");
    }
    const selectors = options.selectors ?? DEFAULT_CLICK_SELECTORS;
    const selector = selectors.join(",");
    const maxPathDepth = options.maxPathDepth ?? 8;
    const maxAttributeLength = options.maxAttributeLength ?? 256;
    const includeText = options.includeText ?? false;
    const listener = (event) => {
        const target = event.target;
        if (!(target instanceof doc.defaultView.Element)) {
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
function buildClickProperties(element, options) {
    const htmlElement = element instanceof options.document.defaultView.HTMLElement ? element : null;
    const attributes = collectAttributes(element, options.maxAttributeLength);
    const properties = {
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
    if (element instanceof options.document.defaultView.HTMLAnchorElement && element.href) {
        properties.href = element.href;
    }
    if (element instanceof options.document.defaultView.HTMLInputElement) {
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
function collectAttributes(element, maxLength) {
    const result = {};
    for (const attribute of Array.from(element.attributes)) {
        if (shouldSkipAttribute(attribute.name)) {
            continue;
        }
        result[attribute.name] = truncate(attribute.value, maxLength);
    }
    return result;
}
function shouldSkipAttribute(name) {
    const normalized = name.toLowerCase();
    return normalized === "value" || normalized === "style";
}
function buildDomPath(element, maxDepth) {
    const parts = [];
    let current = element;
    while (current && parts.length < maxDepth) {
        parts.unshift(buildPathPart(current));
        if (current.id) {
            break;
        }
        current = current.parentElement;
    }
    return parts.join(" > ");
}
function buildPathPart(element) {
    const tagName = element.tagName.toLowerCase();
    if (element.id) {
        return `${tagName}#${cssEscape(element.id)}`;
    }
    const classNames = getClassNames(element);
    const classSuffix = classNames.length > 0 ? `.${classNames.map(cssEscape).join(".")}` : "";
    const index = siblingIndex(element);
    return `${tagName}${classSuffix}:nth-of-type(${index})`;
}
function getClassNames(element) {
    return Array.from(element.classList).filter(Boolean).slice(0, 4);
}
function siblingIndex(element) {
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
function cssEscape(value) {
    const escape = globalThis.CSS?.escape;
    if (escape) {
        return escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return value.slice(0, maxLength);
}
function resolveIdentity(value) {
    if (typeof value === "function") {
        return value();
    }
    return value;
}
//# sourceMappingURL=autotrack.js.map