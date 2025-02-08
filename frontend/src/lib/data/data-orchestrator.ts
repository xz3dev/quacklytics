// // services/dataOrchestrator.ts
// import {FileMetadata, useDownloadFile} from "@/services/file-catalog";
// import {useEffect} from "react";
// import {useFileCatalog} from "@/services/file-catalog.ts";
// import {useProjectId} from "@/hooks/use-project-id.tsx";
// import {useFileFetcher} from "@lib/data/file-fetcher.ts";
// import useAppDataStore from "@lib/data/data-state.ts";
//
// export const useDataOrchestrator = () => {
//     const projectId = useProjectId()
//     const { data: fileCatalog, error } = useFileCatalog(projectId);
//     const fileFetcher = useDownloadFile()
//     const { downloadRange } = useAppDataStore();
//
//     useEffect(() => {
//         const orchestrateData = async () => {
//             if (!fileCatalog) return;
//
//             const neededFiles = determineNeededFiles(fileCatalog, downloadRange);
//             const filesToDownload = neededFiles.filter(
//                 (file) => !localFiles.find((local) => local.filename === file.filename && local.checksum === file.checksum)
//             );
//
//             if (filesToDownload.length > 0) {
//                 await fileFetcher.mutateAsync(filesToDownload);
//             }
//         };
//
//         orchestrateData().catch((error) => {
//             console.error("Data Orchestration Failed:", error);
//             // Optionally update Zustand store with error
//         });
//     }, [fileCatalog, downloadRange, fileFetcher, setFilesInStore]);
// };
//
// const determineNeededFiles = (fileCatalog: FileMetadata[], range: "3" | "6" | "12"): FileMetadata[] => {
//     const now = new Date();
//     let startDate: Date;
//
//     switch (range) {
//         case "3":
//             startDate = new Date();
//             startDate.setMonth(now.getMonth() - 3);
//             break;
//         case "6":
//             startDate = new Date();
//             startDate.setMonth(now.getMonth() - 6);
//             break;
//         case "12":
//             startDate = new Date();
//             startDate.setMonth(now.getMonth() - 12);
//             break;
//         default:
//             startDate = new Date();
//     }
//
//     return fileCatalog.filter((file) => new Date(file.start) >= startDate);
// };
