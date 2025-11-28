import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";
import {
    ref,
    listAll,
    getMetadata,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    getBlob,
} from "firebase/storage";
import { storage } from "../../../../firebase";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { useSelector } from "react-redux";
import { GlobalData } from "../../../../store/global";
import { useAuth } from "../../../../contexts/AuthContext";
import "./FileManagerWidget.css";

interface FileManagerWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

type FileEntry = {
    name: string;
    fullPath: string;
    relativePath: string;
    isFolder: boolean;
    size?: number;
    updated?: string;
};

const PLACEHOLDER_FILE = ".placeholder";
const JSZIP_CDN =
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";

declare global {
    interface Window {
        JSZip?: any;
    }
}

const ensureFolderPath = (path?: string) => {
    if (!path || path === "/") return "/";
    const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
    return trimmed ? `/${trimmed}/` : "/";
};

const joinRelativePath = (base: string, child: string, isFolder = false) => {
    const baseClean =
        base === "/" ? "" : base.replace(/^\/+/, "").replace(/\/+$/, "");
    let childClean = child.replace(/^\/+/, "");
    if (isFolder) childClean = childClean.replace(/\/+$/, "");
    const combined = [baseClean, childClean].filter(Boolean).join("/");
    if (!combined) return "/";
    return isFolder ? `/${combined}/` : `/${combined}`;
};

const loadJSZip = (): Promise<any> => {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = JSZIP_CDN;
        script.async = true;
        script.onload = () => {
            if (window.JSZip) resolve(window.JSZip);
            else reject(new Error("Unable to load JSZip"));
        };
        script.onerror = () => reject(new Error("Failed to load JSZip."));
        document.body.appendChild(script);
    });
};

export default function FileManagerWidget({
    id,
    widgetData,
}: FileManagerWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore();
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const layouts = useSelector((state: GlobalData) => state.layouts);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);
    const activeDashboard = useSelector((state: GlobalData) => state.activeDashboard);
    const { currentUser } = useAuth();

    const storageBasePath = useMemo(() => {
        if (!currentUser) return null;
        return `users/${currentUser.uid}/files`;
    }, [currentUser]);

    const [currentPath, setCurrentPath] = useState(
        ensureFolderPath(widgetData.fileManagerPath || "/")
    );
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const pathSegments = useMemo(() => {
        const segments = currentPath
            .replace(/^\/+/, "")
            .split("/")
            .filter(Boolean);
        const crumbs: string[] = ["/"];
        segments.reduce((acc, segment) => {
            const next = `${acc === "/" ? "" : acc}${segment}/`;
            crumbs.push(next);
            return next;
        }, "/");
        return crumbs;
    }, [currentPath]);

    const persistWidgetState = useCallback(
        async (partial: Partial<Widget>) => {
            const targetWidgets =
                activeDashboard === "home"
                    ? widgets
                    : dashboards.find((d) => d.id === activeDashboard)?.widgets ||
                      [];
            const targetLayouts =
                activeDashboard === "home"
                    ? layouts
                    : dashboards.find((d) => d.id === activeDashboard)?.layouts ||
                      [];

            const updated = targetWidgets.map((w) =>
                w.i === id ? { ...w, ...partial } : w
            );
            await save({ layout: targetLayouts, widgets: updated });
            await saveToFirestore({ widgets: updated });
        },
        [activeDashboard, dashboards, id, layouts, save, saveToFirestore, widgets]
    );

    const resolveStoragePath = useCallback(
        (relative: string, options?: { folder?: boolean }) => {
            if (!storageBasePath) return "";
            let rel = relative;
            if (!rel || rel === "/") {
                rel = "";
            } else {
                rel = rel.replace(/^\/+/, "");
                if (!options?.folder) rel = rel.replace(/\/+$/, "");
            }
            let full = rel ? `${storageBasePath}/${rel}` : storageBasePath;
            if (options?.folder && !full.endsWith("/")) {
                full += "/";
            }
            return full;
        },
        [storageBasePath]
    );

    const toRelativePath = useCallback(
        (fullPath: string, isFolder: boolean) => {
            if (!storageBasePath) return "/";
            let rel = fullPath.slice(storageBasePath.length);
            if (rel.startsWith("/")) rel = rel.slice(1);
            if (isFolder) {
                rel = rel.replace(/\/+$/, "");
                return rel ? `/${rel}/` : "/";
            }
            return rel ? `/${rel}` : "/";
        },
        [storageBasePath]
    );

    const loadEntries = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSelectedPaths(new Set());
        if (!storageBasePath) {
            setEntries([]);
            setLoading(false);
            return;
        }
        try {
            const folderRef = ref(
                storage,
                resolveStoragePath(currentPath, { folder: true })
            );
            const result = await listAll(folderRef);
            const files: FileEntry[] = [];

            for (const folder of result.prefixes) {
                files.push({
                    name: folder.name,
                    fullPath: folder.fullPath,
                    relativePath: toRelativePath(folder.fullPath, true),
                    isFolder: true,
                });
            }
            for (const item of result.items) {
                if (item.name === PLACEHOLDER_FILE) continue;
                const metadata = await getMetadata(item);
                files.push({
                    name: item.name,
                    fullPath: item.fullPath,
                    relativePath: toRelativePath(item.fullPath, false),
                    isFolder: false,
                    size: metadata.size,
                    updated: metadata.updated,
                });
            }

            files.sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });

            setEntries(files);
        } catch (err) {
            console.error(err);
            setError("Unable to list files.");
        } finally {
            setLoading(false);
        }
    }, [currentPath, resolveStoragePath, storageBasePath, toRelativePath]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const changePath = useCallback(
        (path: string) => {
            const formatted = ensureFolderPath(path);
            setCurrentPath(formatted);
            persistWidgetState({ fileManagerPath: formatted });
        },
        [persistWidgetState]
    );

    const persistSelectionReset = () => setSelectedPaths(new Set());

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !storageBasePath) return;
        setLoading(true);
        setError(null);
        try {
            const uploads = Array.from(files).map((file) => {
                const destinationRef = ref(
                    storage,
                    resolveStoragePath(
                        `${currentPath}${file.name}`.replace("//", "/")
                    )
                );
                return uploadBytesResumable(destinationRef, file);
            });
            await Promise.all(uploads);
            loadEntries();
        } catch (err) {
            console.error(err);
            setError("Upload failed.");
        } finally {
            setLoading(false);
            persistSelectionReset();
        }
    };

    const handleCreateFolder = async () => {
        if (!storageBasePath) return;
        const folderName = prompt("Folder name");
        if (!folderName) return;
        setLoading(true);
        setError(null);
        try {
            const folderRelative = joinRelativePath(
                currentPath,
                folderName,
                true
            );
            const placeholderRef = ref(
                storage,
                `${resolveStoragePath(folderRelative, { folder: true })}${PLACEHOLDER_FILE}`
            );
            await uploadBytesResumable(placeholderRef, new Blob());
            loadEntries();
        } catch (err) {
            console.error(err);
            setError("Unable to create folder.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (entry: FileEntry) => {
        if (entry.isFolder) return;
        const url = await getDownloadURL(ref(storage, entry.fullPath));
        window.open(url, "_blank", "noopener");
    };

    const ensureStoragePath = (value: string, isFolder = false) => {
        if (!storageBasePath) return "";
        let relative = (value || "").trim();
        if (!relative || relative === "/") {
            return isFolder ? `${storageBasePath}/` : storageBasePath;
        }
        // Allow callers to pass either absolute storage paths or widget-scoped relative paths.
        relative = relative
            .replace(/^users\/[^/]+\/files\/?/, "")
            .replace(/^\/+/, "");
        if (isFolder) {
            relative = relative.replace(/\/+$/, "");
            return relative ? `${storageBasePath}/${relative}/` : `${storageBasePath}/`;
        }
        relative = relative.replace(/\/+$/, "");
        return relative ? `${storageBasePath}/${relative}` : storageBasePath;
    };

    const moveFile = async (fullPath: string, newNameOrPath: string) => {
        const sourceRef = ref(storage, fullPath);
        let targetPath: string;
        if (newNameOrPath.includes("/")) {
            targetPath = ensureStoragePath(newNameOrPath, false);
        } else {
            const parts = fullPath.split("/");
            parts[parts.length - 1] = newNameOrPath;
            targetPath = parts.join("/");
        }
        const targetRef = ref(storage, targetPath);

        const blob = await getBlob(sourceRef);
        await uploadBytesResumable(targetRef, blob);
        await deleteObject(sourceRef);
    };

    const copyFolder = async (sourcePath: string, targetPath: string) => {
        const folderRef = ref(storage, sourcePath);
        const result = await listAll(folderRef);

        for (const prefix of result.prefixes) {
            await copyFolder(prefix.fullPath, targetPath + prefix.name + "/");
        }

        for (const item of result.items) {
            const blob = await getBlob(item);
            const relativePath = item.fullPath.substring(sourcePath.length);
            const targetRef = ref(storage, targetPath + relativePath);
            await uploadBytesResumable(targetRef, blob);
        }
    };

    const deleteFolder = async (path: string) => {
        const folderRef = ref(storage, path);
        const result = await listAll(folderRef);
        for (const prefix of result.prefixes) {
            await deleteFolder(prefix.fullPath);
        }
        for (const item of result.items) {
            await deleteObject(item);
        }
    };

    const moveFolder = async (fullPath: string, target: string) => {
        let targetPath: string;
        if (target.includes("/")) {
            targetPath = ensureStoragePath(target, true);
        } else {
            const folderSegments = fullPath.split("/");
            folderSegments[folderSegments.length - 2] = target;
            targetPath = folderSegments.slice(0, -1).join("/") + "/";
        }
        await copyFolder(fullPath, targetPath);
        await deleteFolder(fullPath);
    };

    const moveEntry = async (entry: FileEntry, newNameOrPath: string) => {
        setLoading(true);
        setError(null);
        try {
            if (entry.isFolder) {
                await moveFolder(entry.fullPath, newNameOrPath);
            } else {
                await moveFile(entry.fullPath, newNameOrPath);
            }
            loadEntries();
        } catch (err) {
            console.error(err);
            setError("Operation failed.");
        } finally {
            setLoading(false);
            persistSelectionReset();
        }
    };

    const handleRename = async (entry: FileEntry) => {
        const newName = prompt("Rename to", entry.name);
        if (!newName || newName === entry.name) return;
        await moveEntry(entry, newName);
    };

    const handleMove = async (entry: FileEntry) => {
        const destination = prompt(
            "Destination folder (e.g. /Projects):",
            currentPath
        );
        if (!destination) return;
        const sanitized = ensureFolderPath(destination);
        const targetPath = `${sanitized}${entry.name}`.replace("//", "/");
        await moveEntry(entry, targetPath);
    };

    const handleDelete = async (entry: FileEntry) => {
        if (
            !window.confirm(
                `Delete ${entry.isFolder ? "folder" : "file"} "${entry.name}"?`
            )
        ) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (entry.isFolder) {
                await deleteFolder(entry.fullPath);
            } else {
                await deleteObject(ref(storage, entry.fullPath));
            }
            loadEntries();
        } catch (err) {
            console.error(err);
            setError("Delete failed.");
        } finally {
            setLoading(false);
            persistSelectionReset();
        }
    };

    const toggleSelection = (entry: FileEntry) => {
        setSelectedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(entry.fullPath)) {
                next.delete(entry.fullPath);
            } else {
                next.add(entry.fullPath);
            }
            return next;
        });
    };

    const selectedEntries = entries.filter((entry) =>
        selectedPaths.has(entry.fullPath)
    );

    const buildZipPath = (entry: FileEntry) => {
        const relative = (entry.relativePath || "").replace(/^\/+/, "");
        if (!relative) return entry.name;
        if (entry.isFolder) {
            const trimmed = relative.replace(/\/+$/, "");
            return trimmed || entry.name;
        }
        return relative;
    };

    const addFolderToZip = async (
        zipInstance: any,
        folderFullPath: string,
        zipPath: string
    ) => {
        const folderPath = zipPath.replace(/\/+$/, "");
        if (folderPath) {
            zipInstance.folder(folderPath);
        }
        const normalizedPath = folderPath ? `${folderPath}/` : "";
        const folderRef = ref(storage, folderFullPath);
        const result = await listAll(folderRef);

        await Promise.all([
            ...result.items.map(async (item) => {
                if (item.name === PLACEHOLDER_FILE) return;
                const blob = await getBlob(item);
                const pathInZip = normalizedPath
                    ? `${normalizedPath}${item.name}`
                    : item.name;
                zipInstance.file(pathInZip, blob);
            }),
            ...result.prefixes.map((prefix) =>
                addFolderToZip(
                    zipInstance,
                    prefix.fullPath,
                    normalizedPath ? `${normalizedPath}${prefix.name}` : prefix.name
                )
            ),
        ]);
    };

    const handleZipSelection = async () => {
        if (selectedEntries.length === 0 || !storageBasePath) return;
        setLoading(true);
        setError(null);
        try {
            const JSZip = await loadJSZip();
            const zip = new JSZip();
            for (const entry of selectedEntries) {
                if (entry.isFolder) {
                    const zipPath = buildZipPath(entry);
                    await addFolderToZip(zip, entry.fullPath, zipPath);
                } else {
                    const blob = await getBlob(ref(storage, entry.fullPath));
                    const zipPath = buildZipPath(entry);
                    zip.file(zipPath, blob);
                }
            }
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipBlob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `files-${Date.now()}.zip`;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            setError("Unable to create zip.");
        } finally {
            setLoading(false);
            persistSelectionReset();
        }
    };

    const handleUnzip = async () => {
        if (selectedEntries.length !== 1 || !storageBasePath) return;
        const entry = selectedEntries[0];
        if (entry.isFolder || !entry.name.endsWith(".zip")) return;
        setLoading(true);
        setError(null);
        try {
            const JSZip = await loadJSZip();
            const blob = await getBlob(ref(storage, entry.fullPath));
            const zip = await JSZip.loadAsync(blob);
            const uploads: Promise<any>[] = [];

            zip.forEach((relativePath: string, file: any) => {
                if (file.dir) return;
                uploads.push(
                    file.async("blob").then((fileBlob: Blob) => {
                        const relativeTarget = joinRelativePath(
                            currentPath,
                            relativePath
                        );
                        const targetRef = ref(
                            storage,
                            resolveStoragePath(relativeTarget)
                        );
                        return uploadBytesResumable(targetRef, fileBlob);
                    })
                );
            });

            await Promise.all(uploads);
            loadEntries();
        } catch (err) {
            console.error(err);
            setError("Unable to unzip file.");
        } finally {
            setLoading(false);
            persistSelectionReset();
        }
    };

    if (!currentUser) {
        return (
            <div className="widget FileManagerWidget">
                <div className="header">
                    <div className="widgetTitle">File Manager</div>
                    <DeleteWidget id={id} />
                </div>
                <div className="content file-manager-content">
                    <p>Please sign in to use the file manager.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="widget FileManagerWidget">
            <div className="header">
                <div className="widgetTitle">File Manager</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content file-manager-content">
                <div className="fm-toolbar">
                    <button
                        className="fm-button"
                        onClick={() => changePath("/")}
                        title="Root"
                        disabled={loading}
                    >
                        /
                    </button>
                    <button
                        className="fm-button"
                        onClick={handleUploadClick}
                        disabled={loading}
                    >
                        Upload
                    </button>
                    <button
                        className="fm-button"
                        onClick={handleCreateFolder}
                        disabled={loading}
                    >
                        New Folder
                    </button>
                    <button
                        className="fm-button"
                        onClick={handleZipSelection}
                        disabled={selectedEntries.length === 0 || loading}
                    >
                        Zip
                    </button>
                    <button
                        className="fm-button"
                        onClick={handleUnzip}
                        disabled={
                            selectedEntries.length !== 1 ||
                            !selectedEntries[0]?.name.endsWith(".zip") ||
                            loading
                        }
                    >
                        Unzip
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                </div>
                <div className="fm-breadcrumbs">
                    {pathSegments.map((segment, idx) => {
                        const label = idx === 0 ? "Root" : segment.split("/").filter(Boolean).pop();
                        return (
                            <React.Fragment key={`${segment}-${idx}`}>
                                {idx > 0 && <span className="crumb-separator">{">"}</span>}
                                <button
                                    className="crumb"
                                    onClick={() => changePath(segment)}
                                    disabled={loading}
                                >
                                    {label}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
                {error && <div className="fm-error">{error}</div>}
                <div className="fm-table">
                    <div className="fm-table-head">
                        <div />
                        <div>Name</div>
                        <div>Size</div>
                        <div>Updated</div>
                        <div>Actions</div>
                    </div>
                    <div className="fm-table-body">
                        {loading && <div className="fm-loading">Loading…</div>}
                        {!loading && entries.length === 0 && (
                            <div className="fm-empty">This folder is empty.</div>
                        )}
                        {!loading &&
                            entries.map((entry) => (
                                <div key={entry.fullPath} className="fm-row">
                                    <div>
                                        <input
                                            type="checkbox"
                                            checked={selectedPaths.has(entry.fullPath)}
                                            onChange={() => toggleSelection(entry)}
                                        />
                                    </div>
                                    <div
                                        className={`fm-name ${
                                            entry.isFolder ? "folder" : ""
                                        }`}
                                        onClick={() => {
                                            if (entry.isFolder) {
                                                changePath(entry.relativePath);
                                            } else {
                                                handleDownload(entry);
                                            }
                                        }}
                                    >
                                        {entry.name}
                                    </div>
                                    <div>
                                        {entry.isFolder
                                            ? "—"
                                            : entry.size
                                            ? formatBytes(entry.size)
                                            : ""}
                                    </div>
                                    <div>
                                        {entry.updated
                                            ? new Date(entry.updated).toLocaleString()
                                            : ""}
                                    </div>
                                    <div className="fm-actions">
                                        {entry.isFolder ? (
                                            <>
                                                <button
                                                    onClick={() => handleRename(entry)}
                                                    disabled={loading}
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry)}
                                                    disabled={loading}
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleDownload(entry)}
                                                    disabled={loading}
                                                >
                                                    Download
                                                </button>
                                                <button
                                                    onClick={() => handleRename(entry)}
                                                    disabled={loading}
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => handleMove(entry)}
                                                    disabled={loading}
                                                >
                                                    Move
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry)}
                                                    disabled={loading}
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatBytes(bytes?: number) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
