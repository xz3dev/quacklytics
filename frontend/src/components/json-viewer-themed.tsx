import {JsonViewer, NamedColorspace} from '@textea/json-viewer'

const theme: NamedColorspace = {
    base00: "var(--tw-bg)",          // Background color
    base01: "var(--tw-bg-secondary)", // Secondary background color
    base02: "var(--tw-border)",     // Border/line color
    base03: "var(--tw-text-muted)", // Muted text color
    base04: "var(--tw-placeholder)", // Placeholder text color
    base05: "var(--tw-text)",       // Default text color
    base06: "var(--tw-primary)",    // Primary color to emphasize parts of the JSON
    base07: "var(--tw-text-light)", // Light text color
    base08: "var(--tw-error)",      // Error (or red accent) color
    base09: "var(--tw-warning)",    // Warning (or orange accent) color
    base0A: "var(--tw-info)",       // Info/Blue accent color
    base0B: "var(--tw-success)",    // Success (or green accent) color
    base0C: "var(--tw-cyan)",       // Cyan accent color
    base0D: "var(--tw-blue)",       // Blue accent color
    base0E: "var(--tw-purple)",     // Purple accent color
    base0F: "var(--tw-brown)",       // Brown accent color
    scheme: '',
    author: '',
};

interface Props {
    json: any
    rootName?: string
}

export function JsonViewerThemed({json, rootName}: Props) {
    return <>
        <JsonViewer value={json} theme={theme}  defaultInspectDepth={0} rootName={rootName}/>
    </>
}
