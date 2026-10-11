import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/client/api/http.ts";

const fetchServerSetup = async () => {
  return await http.get(
    "/setup",
    z.object({
      adminRegistered: z.boolean(),
      geoip: z.enum(["db-ip", "custom", "off"]),
    }),
  );
};

export const useServerSetup = () => {
  return useQuery({
    queryKey: ["server-setup"],
    queryFn: fetchServerSetup,
  });
};
