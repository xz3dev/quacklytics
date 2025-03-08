import {useQuery} from '@tanstack/react-query';
import {http} from "@lib/fetch.ts";

interface ServerSetup {
    adminRegistered: boolean
}

const fetchServerSetup = async () => {
    return await http.get<ServerSetup>('/setup');
};

export const useServerSetup = () => {
    return useQuery({
        queryKey: ['server-setup'],
        queryFn: fetchServerSetup,
    });
};
