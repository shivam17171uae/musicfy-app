document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    const appContainer = $('#app-container');
    const audioPlayer = document.createElement('audio');
    audioPlayer.id = 'audio-player';
    document.body.appendChild(audioPlayer);
    // New Search Element
    const searchInput = $('#search-input');
    const nowPlayingBar = $('#now-playing-bar');
    const sidebar = $('#sidebar');
    const sidebarOverlay = $('#sidebar-overlay');
    const hamburgerBtn = $('#hamburger-btn');
    const mobileViewTitle = $('#mobile-view-title');
    const viewTitle = $('#view-title');
    const songGrid = $('#song-grid');
    const songList = $('#song-list');
    const desktopViewSwitcher = $('#desktop-view-switcher');
    const mobileViewSwitcher = $('#mobile-view-switcher');
    const playlistList = $('#playlist-list');
    const createPlaylistBtn = $('#create-playlist-btn');
    const newPlaylistInput = $('#new-playlist-name');
    const currentTrack = { title: $('#current-track-title'), artist: $('#current-track-artist'), cover: $('#current-track-cover'), clickable: $('.track-info.clickable') };
    const uploadForm = $('#upload-form');
    const contextMenu = $('#context-menu');
    const likeBtnPlayer = $('#like-btn-player');
    const playerControlsHTML = `<div class="custom-player-ui"><div class="player-buttons"><button id="shuffle-btn" class="control-btn"></button><button id="prev-btn" class="control-btn"></button><button id="play-pause-btn" class="play-btn main-control"></button><button id="next-btn" class="control-btn"></button><button id="repeat-btn" class="control-btn"></button></div><div class="progress-section"><span class="current-time">0:00</span><div class="progress-container"><div class="progress-bar-fill"></div></div><span class="total-time">0:00</span></div></div>`;
    $('#desktop-player-controls').innerHTML = playerControlsHTML;
    $('#fs-player-controls').innerHTML = playerControlsHTML.replace('progress-section', 'progress-section fs-progress');
    const player = { playPauseBtns: $$('#play-pause-btn, #mobile-play-pause-btn'), nextBtns: $$('#next-btn'), prevBtns: $$('#prev-btn'), shuffleBtns: $$('#shuffle-btn'), repeatBtns: $$('#repeat-btn'), progressContainers: $$('.progress-container'), progressBarFills: $$('.progress-bar-fill'), currentTimes: $$('.current-time'), totalTimes: $$('.total-time') };
    const fsPlayer = { container: $('#full-screen-player'), cover: $('#fs-cover-art'), title: $('#fs-title'), artist: $('#fs-artist') };
    let library = [], playlists = {}, currentView = { type: 'library', name: 'Library' }, playbackState = { queue: [], currentIndex: -1, isShuffle: false, repeatMode: 'none' }, currentLayout = localStorage.getItem('music-app-layout') || 'grid';
    const colorThief = new ColorThief();
    const api = { get: (url) => fetch(url).then(res => res.json()), post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(res => res.json()), delete: (url, body) => fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(res => res.json()) };
    const fetchData = async () => { [library, playlists] = await Promise.all([api.get('/api/library'), api.get('/api/playlists')]); };
    const render = () => { renderPlaylists(); renderMainView(); updateActiveNav(); };
    const renderMainView = () => {
        songGrid.innerHTML = ''; songList.innerHTML = ''; viewTitle.textContent = currentView.name;
        let songsToRender = currentView.type === 'library' ? [...library].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)) : library.filter(s => playlists[currentView.name]?.includes(s.filename));
        
        // --- NEW: SEARCH FILTER LOGIC ---
        const searchQuery = searchInput.value.toLowerCase().trim();
        if (searchQuery) {
            songsToRender = songsToRender.filter(song =>
                song.title.toLowerCase().includes(searchQuery) ||
                song.artist.toLowerCase().includes(searchQuery) ||
                song.album.toLowerCase().includes(searchQuery)
            );
        }

        if (songsToRender.length === 0) {
            const message = searchQuery 
                ? `No results found for "${searchInput.value}"` 
                : `${currentView.name} is empty.`;
            songGrid.innerHTML = `<p>${message}</p>`;
            songList.innerHTML = `<p>${message}</p>`;
            return;
        }
        
        if (currentLayout === 'grid') {
            songGrid.style.display = 'grid'; songList.style.display = 'none';
            songsToRender.forEach(song => {
                const card = document.createElement('div'); card.className = 'song-card'; card.dataset.filename = song.filename; card.setAttribute('draggable', 'true');
                card.innerHTML = `<div class="cover-art-wrapper"><img src="${song.coverArtUrl}" alt="${song.title}" loading="lazy"></div><div class="song-title">${song.title}</div><div class="song-artist">${song.artist}</div>`;
                card.addEventListener('click', (e) => handleCardClick(e, song, songsToRender)); card.addEventListener('contextmenu', (e) => showContextMenu(e, song)); card.addEventListener('dragstart', handleDragStart);
                songGrid.appendChild(card);
            });
        } else {
            songGrid.style.display = 'none'; songList.style.display = 'block';
            songList.innerHTML = `<div class="song-list-header"><div class="header-item">#</div><div class="header-item">Title</div><div class="header-item">Album</div><div class="header-item">Date Added</div><div class="header-item">🕒</div></div>`;
            songsToRender.forEach((song, index) => {
                const row = document.createElement('div'); row.className = 'song-row'; row.dataset.filename = song.filename;
                row.innerHTML = `<div class="song-row-index">${index + 1}</div><div class="song-row-title-artist"><img src="${song.coverArtUrl}" class="song-row-cover" loading="lazy"><div class="song-row-details"><span class="song-row-title">${song.title}</span><span class="song-row-artist">${song.artist}</span></div></div><div class="song-row-album">${song.album}</div><div class="song-row-date">${new Date(song.dateAdded).toLocaleDateString()}</div><div class="song-row-duration">${formatTime(song.duration)}</div>`;
                row.addEventListener('click', (e) => handleCardClick(e, song, songsToRender)); row.addEventListener('contextmenu', (e) => showContextMenu(e, song)); row.addEventListener('dragstart', handleDragStart);
                songList.appendChild(row);
            });
        }
        updatePlayingUI();
    };
    const updatePlayingUI = () => { const currentSong = playbackState.queue[playbackState.currentIndex]; if (!currentSong) return; $$('.song-card, .song-row').forEach(el => { el.classList.toggle('playing', el.dataset.filename === currentSong.filename); }); };
    const renderPlaylists = () => { playlistList.innerHTML = ''; const sortedPlaylists = Object.keys(playlists).sort((a, b) => a === "Liked Songs" ? -1 : b === "Liked Songs" ? 1 : a.localeCompare(b)); sortedPlaylists.forEach(name => { const li = document.createElement('li'); li.textContent = name; li.dataset.playlistName = name; li.addEventListener('click', () => { searchInput.value = ''; currentView = { type: 'playlist', name }; switchView('library-view'); hideSidebar(); }); li.addEventListener('dragover', (e) => e.preventDefault()); li.addEventListener('dragenter', () => li.classList.add('drop-target')); li.addEventListener('dragleave', () => li.classList.remove('drop-target')); li.addEventListener('drop', handleDropOnPlaylist); playlistList.appendChild(li); }); };
    const updatePlayerTheme = (imageUrl) => { const defaultColor = 'transparent'; const defaultFsColor = 'var(--bg-tertiary)'; const applyColors = (barColor, fsColor) => { nowPlayingBar.style.setProperty('--dynamic-bg-color', barColor); fsPlayer.container.style.setProperty('--fs-dynamic-bg', fsColor); }; if (!imageUrl || imageUrl.endsWith('default.svg')) { applyColors(defaultColor, defaultFsColor); return; } const img = new Image(); img.crossOrigin = "Anonymous"; img.src = imageUrl; img.onload = () => { const [r, g, b] = colorThief.getColor(img); applyColors(`rgba(${r}, ${g}, ${b}, 0.3)`, `rgb(${r}, ${g}, ${b})`); }; img.onerror = () => applyColors(defaultColor, defaultFsColor); };
    const setQueueAndPlay = (songs, startSong) => { playbackState.queue = [...songs]; playbackState.currentIndex = playbackState.queue.findIndex(s => s.filename === startSong.filename); loadAndPlayCurrentSong(); };
    const loadAndPlayCurrentSong = () => { updatePlayingUI(); if (playbackState.currentIndex < 0 || playbackState.currentIndex >= playbackState.queue.length) { audioPlayer.pause(); currentTrack.title.textContent = "No song playing"; return; } const song = playbackState.queue[playbackState.currentIndex]; audioPlayer.src = `/music/${song.filename}`; audioPlayer.play(); currentTrack.title.textContent = song.title; currentTrack.artist.textContent = song.artist; currentTrack.cover.src = song.coverArtUrl; fsPlayer.cover.src = song.coverArtUrl; fsPlayer.title.textContent = song.title; fsPlayer.artist.textContent = song.artist; updatePlayerTheme(song.coverArtUrl); updateLikeButtonState(song.liked); };
    const playNext = () => { if (playbackState.queue.length === 0) return; if (playbackState.isShuffle) { playbackState.currentIndex = Math.floor(Math.random() * playbackState.queue.length); } else { playbackState.currentIndex++; if (playbackState.currentIndex >= playbackState.queue.length) { if (playbackState.repeatMode === 'all') playbackState.currentIndex = 0; else { playbackState.currentIndex = -1; return; } } } loadAndPlayCurrentSong(); };
    const playPrev = () => { if (playbackState.queue.length === 0) return; if (audioPlayer.currentTime > 3) audioPlayer.currentTime = 0; else { playbackState.currentIndex--; if (playbackState.currentIndex < 0) playbackState.currentIndex = playbackState.queue.length - 1; loadAndPlayCurrentSong(); } };
    const handleCardClick = (e, song, songsInView) => { const card = e.currentTarget; if (e.ctrlKey || e.metaKey) card.classList.toggle('selected'); else { $$('.song-card.selected, .song-row.selected').forEach(c => c.classList.remove('selected')); setQueueAndPlay(songsInView, song); } };
    const showContextMenu = (e, song) => { e.preventDefault(); contextMenu.style.display = 'block'; contextMenu.style.left = `${e.pageX}px`; contextMenu.style.top = `${e.pageY}px`; let menuItems = `<ul><li data-action="play">Play Next</li><li data-action="queue">Add to Queue</li>`; if (currentView.type === 'playlist' && currentView.name !== 'Liked Songs') menuItems += `<li data-action="remove-from-playlist">Remove from Playlist</li>`; menuItems += `<hr><li data-action="delete" class="delete">Delete from Library</li></ul>`; const hideMenu = () => { contextMenu.style.display = 'none'; document.removeEventListener('click', hideMenu); }; contextMenu.innerHTML = menuItems; setTimeout(() => document.addEventListener('click', hideMenu), 0); };
    player.playPauseBtns.forEach(btn => btn.addEventListener('click', () => audioPlayer.src ? (audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause()) : null));
    player.nextBtns.forEach(btn => btn.addEventListener('click', playNext));
    player.prevBtns.forEach(btn => btn.addEventListener('click', playPrev));
    player.shuffleBtns.forEach(btn => btn.addEventListener('click', () => { playbackState.isShuffle = !playbackState.isShuffle; player.shuffleBtns.forEach(b => b.classList.toggle('active', playbackState.isShuffle)); showToast(`Shuffle ${playbackState.isShuffle ? 'On' : 'Off'}`); }));
    player.repeatBtns.forEach(btn => btn.addEventListener('click', () => { const modes = ['none', 'all', 'one']; playbackState.repeatMode = modes[(modes.indexOf(playbackState.repeatMode) + 1) % modes.length]; player.repeatBtns.forEach(b => { b.classList.toggle('active', playbackState.repeatMode !== 'none'); const oneIcon = b.querySelector('.repeat-one-icon'); if (oneIcon) oneIcon.style.display = playbackState.repeatMode === 'one' ? 'block' : 'none'; }); showToast(`Repeat: ${playbackState.repeatMode.charAt(0).toUpperCase() + playbackState.repeatMode.slice(1)}`); }));
    audioPlayer.addEventListener('play', () => player.playPauseBtns.forEach(b => b.className = 'pause-btn main-control'));
    audioPlayer.addEventListener('pause', () => player.playPauseBtns.forEach(b => b.className = 'play-btn main-control'));
    audioPlayer.addEventListener('ended', () => { if (playbackState.repeatMode === 'one' && audioPlayer.src) { audioPlayer.currentTime = 0; audioPlayer.play(); } else { playNext(); } });
    audioPlayer.addEventListener('loadedmetadata', () => player.totalTimes.forEach(el => el.textContent = formatTime(audioPlayer.duration)));
    audioPlayer.addEventListener('timeupdate', () => { const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100; player.progressBarFills.forEach(el => el.style.width = `${progress || 0}%`); player.currentTimes.forEach(el => el.textContent = formatTime(audioPlayer.currentTime)); });
    player.progressContainers.forEach(pc => pc.addEventListener('click', e => { if (audioPlayer.duration) audioPlayer.currentTime = (e.offsetX / pc.clientWidth) * audioPlayer.duration; }));
    likeBtnPlayer.addEventListener('click', async (e) => { e.stopPropagation(); const song = playbackState.queue[playbackState.currentIndex]; if (!song) return; const res = await api.post('/api/like-song', { songFilename: song.filename }); song.liked = res.liked; updateLikeButtonState(res.liked); showToast(res.liked ? 'Added to Liked Songs' : 'Removed from Liked Songs'); const librarySong = library.find(s => s.filename === song.filename); if (librarySong) librarySong.liked = res.liked; if (currentView.name === "Liked Songs") renderMainView(); });
    const updateLikeButtonState = (isLiked) => { likeBtnPlayer.classList.toggle('liked', isLiked); const icon = isLiked ? `<svg role="img" height="20" width="20" viewBox="0 0 24 24"><path fill="white" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : `<svg role="img" height="20" width="20" viewBox="0 0 24 24"><path fill="white" d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"></path></svg>`; likeBtnPlayer.innerHTML = icon; }; updateLikeButtonState(false);
    const openFsPlayer = () => { if (audioPlayer.src) { fsPlayer.container.classList.add('visible'); appContainer.classList.add('fs-active'); } }; const closeFsPlayer = () => { fsPlayer.container.classList.remove('visible'); appContainer.classList.remove('fs-active'); setTimeout(() => { fsPlayer.container.style.transform = ''; fsPlayer.container.style.opacity = ''; }, 300); };
    currentTrack.clickable.addEventListener('click', openFsPlayer); document.addEventListener('keydown', (e) => { if (e.key === "Escape" && fsPlayer.container.classList.contains('visible')) closeFsPlayer(); });
    let touchStartY = 0, touchMoveY = 0; fsPlayer.container.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; fsPlayer.container.style.transition = 'none'; }, { passive: true }); fsPlayer.container.addEventListener('touchmove', (e) => { touchMoveY = e.touches[0].clientY; const swipeDistance = touchMoveY - touchStartY; if (swipeDistance > 0) { fsPlayer.container.style.transform = `translateY(${swipeDistance}px)`; const opacity = Math.max(1 - (swipeDistance / window.innerHeight) * 1.5, 0.5); fsPlayer.container.style.opacity = opacity; } }, { passive: true }); fsPlayer.container.addEventListener('touchend', () => { const swipeDistance = touchMoveY - touchStartY; fsPlayer.container.style.transition = 'opacity .3s ease, transform .3s ease'; if (swipeDistance > 100) closeFsPlayer(); else { fsPlayer.container.style.transform = 'translateY(0)'; fsPlayer.container.style.opacity = '1'; } touchStartY = 0; touchMoveY = 0; });
    const formatTime = s => s && !isNaN(s) ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'; const showToast = (m, t = 'success') => { const e = document.createElement('div'); e.className = `toast ${t}`, e.textContent = m, $('#toast-container').appendChild(e), setTimeout(() => e.remove(), 3e3) }; const switchView = (v) => { $$('.view').forEach(e => e.classList.remove('active')), $(`#${v}`).classList.add('active'), render() }; const updateActiveNav = () => { $$('.nav-links li, #playlist-list li').forEach(e => e.classList.remove('active')); const t = { library: '#nav-library', upload: '#nav-upload', playlist: `li[data-playlist-name="${currentView.name}"]` }[currentView.type]; $(t)?.classList.add('active') };
    // --- NEW: EVENT LISTENER FOR SEARCH INPUT ---
    searchInput.addEventListener('input', renderMainView);
    createPlaylistBtn.addEventListener('click', async () => { const e = newPlaylistInput.value.trim(); if (!e) return; await api.post('/api/playlists', { name: e }), newPlaylistInput.value = '', await fetchData(), renderPlaylists(), showToast(`Playlist '${e}' created`) });
    $('#nav-library').addEventListener('click', () => { searchInput.value = ''; currentView = { type: 'library', name: 'Library' }; switchView('library-view'); hideSidebar() });
    $('#nav-upload').addEventListener('click', () => { currentView = { type: 'upload', name: 'Upload Music' }, switchView('upload-view'); hideSidebar() });
    const handleUploadFiles = (e) => { const uploadPreview = $('#upload-preview'), uploadPreviewWrapper = $('#upload-preview-wrapper'); uploadPreview.innerHTML = ''; if (0 === e.length) { uploadPreviewWrapper.style.display = 'none'; return } uploadPreviewWrapper.style.display = 'block'; Array.from(e).forEach(e => { const t = document.createElement('li'); t.textContent = e.name, uploadPreview.appendChild(t) }) };
    $('#file-input').addEventListener('change', e => handleUploadFiles(e.target.files));
    uploadForm.addEventListener('submit', async e => { e.preventDefault(); const t = $('#file-input'); if (0 === t.files.length) return; const a = new FormData; for (const e of t.files) a.append('musicFiles', e); const s = $('#upload-status'); s.textContent = `Uploading...`; const i = await (await fetch('/api/upload', { method: 'POST', body: a })).json(); s.textContent = i.message, showToast(i.message), await fetchData(), 'library' === currentView.type && renderMainView(), t.value = '', $('#upload-preview').innerHTML = '', $('#upload-preview-wrapper').style.display = 'none' });
    const handleDragStart = (e) => { const t = e.currentTarget; if (!t.classList.contains('selected')) { $$('.song-card.selected, .song-row.selected').forEach(e => e.classList.remove('selected')); t.classList.add('selected'); } const a = Array.from($$('.song-card.selected, .song-row.selected')).map(e => e.dataset.filename); e.dataTransfer.setData('application/json', JSON.stringify(a)); const s = document.createElement("div"), i = library.find(e => e.filename === a[0]); s.className = 'drag-image'; s.innerHTML = `<img src="${i.coverArtUrl}"><div class="drag-info"><span class="drag-title">${i.title}</span>${a.length > 1 ? `<span class="drag-count">${a.length} songs</span>` : `<span class="drag-count">${i.artist}</span>`}</div>`; document.body.appendChild(s); e.dataTransfer.setDragImage(s, 25, 25); setTimeout(() => document.body.removeChild(s), 0) };
    const handleDropOnPlaylist = async e => { e.preventDefault(); const t = e.currentTarget.dataset.playlistName; e.currentTarget.classList.remove('drop-target'); const a = JSON.parse(e.dataTransfer.getData('application/json')); await api.post(`/api/playlists/${t}/add-multiple`, { songFilenames: a }); showToast(`${a.length} song(s) added to ${t}`); $$('.song-card.selected, .song-row.selected').forEach(e => e.classList.remove('selected')); await fetchData(); currentView.type === 'playlist' && currentView.name === t && renderMainView() };
    const hideSidebar = () => { sidebar.classList.remove('visible'); sidebarOverlay.classList.remove('visible'); };
    hamburgerBtn.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.add('visible'); sidebarOverlay.classList.add('visible'); });
    sidebarOverlay.addEventListener('click', hideSidebar);
    const initSVGs = () => { const switcherHTML = `<button class="view-btn list-view-btn"><svg viewBox="0 0 24 24"><path fill="white" d="M3 13h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V7H3v2z"></path></svg></button><button class="view-btn grid-view-btn"><svg viewBox="0 0 24 24"><path fill="white" d="M4 4h7v7H4V4zm0 9h7v7H4v-7zM13 4h7v7h-7V4zm0 9h7v7h-7v-7z"></path></svg></button>`; desktopViewSwitcher.innerHTML = switcherHTML; mobileViewSwitcher.innerHTML = switcherHTML; $$('#shuffle-btn').forEach(b => b.innerHTML = `<svg role="img" height="20" width="20" viewBox="0 0 24 24"><path fill="white" d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"></path></svg>`); $$('#prev-btn').forEach(b => b.innerHTML = `<svg role="img" height="20" width="20" viewBox="0 0 24 24"><path fill="white" d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg>`); $$('#next-btn').forEach(b => b.innerHTML = `<svg role="img" height="20" width="20" viewBox="0 0 24 24"><path fill="white" d="M8 5v14l11-7zM18 6h2v12h-2z"></path></svg>`); $$('#repeat-btn').forEach(b => b.innerHTML = `<svg role="img" height="20" width="20" viewBox="0 0 24 24"><path fill="white" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"></path></svg><span class="repeat-one-icon" style="position:absolute; top: 0; right: 0; font-size: 10px; background: var(--accent); color: #000; border-radius: 50%; width: 12px; height: 12px; text-align: center; line-height: 12px; font-weight: bold; display: none;">1</span>`); };
    const switchLayout = (layout) => { currentLayout = layout; localStorage.setItem('music-app-layout', layout); $$('.grid-view-btn').forEach(b => b.classList.toggle('active', layout === 'grid')); $$('.list-view-btn').forEach(b => b.classList.toggle('active', layout === 'list')); renderMainView(); };
    (async () => { await fetchData(); initSVGs(); $$('.grid-view-btn').forEach(b => b.addEventListener('click', () => switchLayout('grid'))); $$('.list-view-btn').forEach(b => b.addEventListener('click', () => switchLayout('list'))); switchLayout(currentLayout); render(); })();
});
