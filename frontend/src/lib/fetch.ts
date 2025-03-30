import axios, { AxiosRequestConfig } from 'axios';
import { baseUrl } from "@app/conf.ts";

const axiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

const get = async <T>(url: string) => {
    const { data } = await axiosInstance.get<T>(url);
    return data;
};

const del = async <T>(url: string) => {
    const { data } = await axiosInstance.delete<T>(url);
    return data;
};

const post = async <T>(url: string, body?: unknown) => {
    const { data } = await axiosInstance.post<T>(url, body);
    return data;
};

const put = async <T>(url: string, body?: unknown) => {
    const { data } = await axiosInstance.put<T>(url, body);
    return data;
};

const getBlob = async (url: string, config?: AxiosRequestConfig) => {
    const { data } = await axiosInstance.get(url, { ...config, responseType: 'blob' });
    return data;
};

export const http = {
    get,
    post,
    put,
    del,
    getBlob,
};
