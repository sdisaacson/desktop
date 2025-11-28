import React, { useState, useEffect } from "react";
import "./YouTubeWidget.css";
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { useSelector } from "react-redux";
import { GlobalData } from "../../../../store/global";
import axios from "axios";
import { Settings, Plus, X } from "react-feather";

interface YouTubeWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

interface VideoItem {
    title: string;
    link: string;
    thumbnail: string;
    description: string;
    author: string;
    pubDate: string;
}

export default function YouTubeWidget({ id, theme, widgetData }: YouTubeWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore(); // Hook for Firebase persistence
    
    // Select specific fields
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const layouts = useSelector((state: GlobalData) => state.layouts);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);
    const activeDashboard = useSelector((state: GlobalData) => state.activeDashboard);

    const defaultChannelId = "UC0C-17n9iuUQPylguM1d-lQ"; // Google Developers Channel

    // If no channel IDs are saved in widgetData, use the default and start in configuring mode.
    // If channel IDs are present (even empty array from user action), use them.
    const initialChannelInputs = widgetData.channelIds && widgetData.channelIds.length > 0
        ? widgetData.channelIds
        : [defaultChannelId];

    const initialIsConfiguring = !widgetData.channelIds || widgetData.channelIds.length === 0;

    // Widget State
    const [isConfiguring, setIsConfiguring] = useState(initialIsConfiguring);
    const [channelInputs, setChannelInputs] = useState<string[]>(initialChannelInputs);
    const [videoCountInput, setVideoCountInput] = useState<number>(widgetData.videoCount || 10);
    const [orientationInput, setOrientationInput] = useState<'vertical' | 'horizontal' | 'grid'>(widgetData.orientation || 'vertical');
    
    // Data State
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Videos logic
    const fetchVideos = async (channels: string[], count: number) => {
        if (!channels || channels.length === 0) return;
        setLoading(true);
        setError(null);
        let allVideos: VideoItem[] = [];

        try {
            const promises = channels.map(async (channelId) => {
                // Use rss2json to bypass CORS and parse XML
                const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
                const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
                
                const response = await axios.get(apiUrl);
                if (response.data.status === 'ok') {
                    const items = response.data.items.slice(0, count).map((item: any) => ({
                        title: item.title,
                        link: item.link,
                        thumbnail: item.thumbnail, 
                        description: item.description || "",
                        author: item.author,
                        pubDate: item.pubDate
                    }));
                    return items;
                } else {
                    console.warn(`Failed to fetch for channel ${channelId}`);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            results.forEach(channelVideos => {
                allVideos = [...allVideos, ...channelVideos];
            });
            
            // Sort by date descending
            allVideos.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
            
            setVideos(allVideos);
        } catch (err) {
            console.error(err);
            setError("Failed to load videos. Check Channel IDs.");
        } finally {
            setLoading(false);
        }
    };

    // Save preferences to Redux AND Firestore
    const savePreferences = async () => {
        // Validate inputs: Allow alphanumeric, underscores, and hyphens for YouTube IDs
        const validChannels = channelInputs.filter(c => /^[a-zA-Z0-9_-]+$/.test(c));
        
        console.log("Saving channels:", validChannels); // Debug log

        const currentWidgetsList = activeDashboard === "home" 
            ? widgets 
            : dashboards.find(d => d.id === activeDashboard)?.widgets || [];
        
        const currentLayoutList = activeDashboard === "home"
            ? layouts
            : dashboards.find(d => d.id === activeDashboard)?.layouts || [];

        const newWidgets = currentWidgetsList.map(w => w.i === id ? { 
            ...w, 
            channelIds: validChannels,
            videoCount: videoCountInput || 10, // Default to 10 if NaN/0
            orientation: orientationInput
        } : w);
        
        // Save to Redux/Local Storage (via useBoard)
        save({ layout: currentLayoutList, widgets: newWidgets });
        
        // Save to Firestore (Requirement)
        await saveToFirestore({ widgets: newWidgets });

        setIsConfiguring(false);
        fetchVideos(validChannels, videoCountInput || 10);
    };

    // Initial Fetch on mount if configured
    useEffect(() => {
        if (widgetData.channelIds && widgetData.channelIds.length > 0) {
            fetchVideos(widgetData.channelIds, widgetData.videoCount || 3);
        }
        // eslint-disable-next-line
    }, []); 

    // Handlers for Setup UI
    const handleChannelChange = (index: number, value: string) => {
        const newInputs = [...channelInputs];
        newInputs[index] = value;
        setChannelInputs(newInputs);
    };

    const addChannelInput = () => {
        setChannelInputs([...channelInputs, ""]);
    };

    const removeChannelInput = (index: number) => {
        const newInputs = channelInputs.filter((_, i) => i !== index);
        setChannelInputs(newInputs);
    };

    return (
        <div className={`widget YouTubeWidget`}>
            <div className="header">
                <div className="widgetTitle">
                    YouTube Feed
                </div>
                <div className="widgetButtons" style={{display: 'flex', alignItems: 'center', gap: 5}} onMouseDown={(e) => e.stopPropagation()}>
                    <button className="youtube-icon-btn" onClick={() => setIsConfiguring(!isConfiguring)} title="Settings" style={{padding: 4}}>
                        <Settings size={12}/>
                    </button>
                    <DeleteWidget id={id} />
                </div>
            </div>
            
            <div className="youtube-content">
                {isConfiguring ? (
                    <div className="youtube-setup">
                        
                        <label>Channel IDs:</label>
                        <div className="channel-list">
                            {channelInputs.map((input, index) => (
                                <div key={index} className="channel-input-row">
                                    <input 
                                        type="text" 
                                        className="youtube-input"
                                        placeholder="Channel ID (e.g. UC...)"
                                        value={input}
                                        onChange={(e) => handleChannelChange(index, e.target.value)}
                                    />
                                    {channelInputs.length > 1 && (
                                        <button className="youtube-icon-btn danger" onClick={() => removeChannelInput(index)}>
                                            <X size={14}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button className="youtube-save-btn youtube-add-channel-btn" onClick={addChannelInput}>
                                <Plus size={12}/> Add Channel
                            </button>
                        </div>

                        <label>Number of Videos (per channel):</label>
                        <input 
                            type="text" /* Changed from type="number" */
                            className="youtube-input"
                            value={videoCountInput}
                            min={1}
                            max={10}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setVideoCountInput(isNaN(val) ? 0 : val);
                            }}
                        />

                        <label>Orientation:</label>
                        <select 
                            className="youtube-input"
                            value={orientationInput}
                            onChange={(e) => setOrientationInput(e.target.value as any)}
                        >
                            <option value="vertical">Vertical List</option>
                            <option value="horizontal">Horizontal Scroll</option>
                            <option value="grid">Grid</option>
                        </select>

                        <button className="youtube-save-btn" onClick={savePreferences}>
                            Save & Refresh
                        </button>
                    </div>
                ) : (
                    <div className={`youtube-feed ${orientationInput}`}>
                        {loading && <div className="youtube-loading">Loading videos...</div>}
                        {error && <div className="youtube-error">{error}</div>}
                        
                        {!loading && videos.length === 0 && !error && (
                            <div className="youtube-empty">No videos found. Check config.</div>
                        )}

                        {videos.map((video, idx) => (
                            <div key={idx} className="youtube-video-item" onClick={() => window.open(video.link, '_blank')}>
                                <div className="video-thumb">
                                    <img src={video.thumbnail} alt={video.title} />
                                </div>
                                <div className="video-info">
                                    <div className="video-title">{video.title}</div>
                                    <div className="video-meta">{video.author} • {new Date(video.pubDate).toLocaleDateString()}</div>
                                    <div className="video-desc" title={video.description}>
                                        {video.description && video.description.length > 100 ? video.description.substring(0, 100) + "..." : video.description}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
