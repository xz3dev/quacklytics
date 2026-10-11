import { geoEqualEarth, geoPath } from "d3-geo";
import { useMemo } from "react";
import { useCountryShapes } from "@/lib/world-countries";

export function ChartEmptyMap({ fill }: { fill: string }) {
  const { data: shapes } = useCountryShapes();
  const countries = useMemo(() => {
    if (!shapes) return [];
    // Use the populated map's geography and projection so the preview keeps
    // recognizable coastlines, islands, and country borders at every size.
    const projection = geoEqualEarth().fitExtent(
      [
        [12, 12],
        [468, 218],
      ],
      { type: "FeatureCollection", features: shapes },
    );
    const path = geoPath(projection);
    return shapes.map((shape) => ({
      name: shape.properties.name,
      path: path(shape) ?? undefined,
    }));
  }, [shapes]);

  return (
    <g
      fill={fill}
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="0.45"
      strokeLinejoin="round"
    >
      {countries.map((country) => (
        <path key={country.name} d={country.path} />
      ))}
    </g>
  );
}
