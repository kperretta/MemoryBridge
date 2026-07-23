/**
 * Navbar condivisa con styling coordinato a Memory Bridge.
 * Uso: <div id="navbar-slot"></div> + renderNavbar('home').
 * Sezioni: home | chat | create | tree | invite | profile
 */

(function injectNavbarStyles() {
    if (document.getElementById('mb-navbar-styles')) return;
    const style = document.createElement('style');
    style.id = 'mb-navbar-styles';
    style.innerHTML = `
        .navbar-wrapper {
            position: sticky;
            top: 0;
            z-index: 1000;
            width: 100%; /* Full Width */
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border-bottom: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            box-sizing: border-box;
        }

        .navbar {
            width: 100%;
            padding: 12px 32px; /* Ampia e bilanciata */
            display: flex;
            align-items: center; /* Centratura verticale */
            justify-content: space-between;
            box-sizing: border-box;
            gap: 20px;
        }

        /* LOGO E NOME INGRANDITI */
        .navbar .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            transition: transform 0.25s ease;
            flex-shrink: 0;
        }

        .navbar .logo:hover {
            transform: scale(1.03);
        }

        .navbar .logo-icon {
            height: 64px; /* Ingrandito da 46px */
            width: auto;
            object-fit: contain;
            display: block;
        }

        .navbar .logo-title {
            height: 52px; /* Ingrandito da 36px */
            width: auto;
            object-fit: contain;
            display: block;
        }

        .nav-links {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        .nav-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 99px;
            color: #475569;
            font-size: 0.92rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            white-space: nowrap;
        }

        .nav-link svg {
            transition: transform 0.2s ease, stroke 0.2s ease;
            flex-shrink: 0;
        }

        .nav-link:hover {
            color: #33628F;
            background: rgba(78, 133, 191, 0.08);
        }

        .nav-link:hover svg {
            transform: translateY(-1px);
        }

        .nav-link.active {
            color: #ffffff;
            background: #33628F;
            box-shadow: 0 4px 12px rgba(51, 98, 143, 0.22);
        }

        .nav-link.active svg {
            stroke: #ffffff;
        }

        /* BADGE UTENTE & LOGOUT */
        .user-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 7px 16px;
            border-radius: 99px;
            background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
            color: #0369a1;
            font-weight: 700;
            font-size: 0.88rem;
            text-decoration: none;
            border: 1px solid rgba(186, 230, 253, 0.8);
            transition: all 0.2s ease;
            margin-left: 6px;
            white-space: nowrap;
        }

        .user-badge:hover {
            background: #0369a1;
            color: #ffffff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(3, 105, 161, 0.2);
        }

        .user-badge.active {
            background: #0284c7;
            color: #ffffff;
        }

        /* --- BOTTONE LOGOUT: più leggibile --- */
        .btn-logout {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            color: #475569;                          /* più scuro, ben leggibile */
            background: #f1f5f9;
            border: 1px solid #e2e8f0;               /* bordo definito */
            text-decoration: none;
            transition: all 0.2s ease;
            margin-left: 4px;
            flex-shrink: 0;
            padding: 0;
        }

        .btn-logout svg {
            display: block;
            flex-shrink: 0;
        }

        .btn-logout:hover {
            color: #ffffff;
            background: #ef4444;                     /* rosso pieno all'hover */
            border-color: #ef4444;
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
        }

        @media (max-width: 900px) {
            .navbar {
                padding: 12px 16px;
                flex-direction: column;
                justify-content: center;
            }
            .navbar .logo-icon {
                height: 50px;
            }
            .navbar .logo-title {
                height: 40px;
            }
            .nav-links {
                justify-content: center;
                width: 100%;
                gap: 4px;
            }
            .nav-link {
                padding: 6px 12px;
                font-size: 0.84rem;
            }
        }
    `;
    document.head.appendChild(style);
})();

function renderNavbar(activeSection) {
    const slot = document.getElementById('navbar-slot');
    if (!slot) return;

    const user = window.currentUser;
    const name = user ? user.firstName : '';
    const memberId = user ? user.familyMemberId : null;

    // Badge nome: tre stati possibili
    let userBadge = '';
    if (name && memberId) {
        userBadge = `
            <a href="profile.html?id=${memberId}" class="user-badge ${activeSection === 'profile' ? 'active' : ''}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>${name}</span>
            </a>`;
    } else if (name) {
        userBadge = `
            <a href="link-member.html" class="user-badge" title="Collega il tuo profilo all'albero">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                <span>${name}</span>
            </a>`;
    }

    slot.innerHTML = `
        <header class="navbar-wrapper">
            <nav class="navbar">
                <a href="home.html" class="logo">
                    <img src="img/site/logo.png" alt="Memory Bridge" class="logo-icon">
                    <img src="img/site/title.png" alt="Memory Bridge" class="logo-title">
                </a>
                <div class="nav-links">
                    <a href="home.html" class="nav-link ${activeSection === 'home' ? 'active' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <span>Home</span>
                    </a>
                    <a href="chat.html" class="nav-link ${activeSection === 'chat' ? 'active' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        <span>Racconta un ricordo</span>
                    </a>
                    <a href="create.html" class="nav-link ${activeSection === 'create' ? 'active' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Crea un contenuto</span>
                    </a>
                    <a href="tree.html" class="nav-link ${activeSection === 'tree' ? 'active' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M12 12L7 7"></path><path d="M12 12l5-5"></path><path d="M12 16l-4 4"></path><path d="M12 16l4 4"></path><circle cx="12" cy="3" r="1.5"></circle><circle cx="6" cy="6" r="1.5"></circle><circle cx="18" cy="6" r="1.5"></circle></svg>
                        <span>Albero Genealogico</span>
                    </a>
                    <a href="invite.html" class="nav-link ${activeSection === 'invite' ? 'active' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="17" y1="11" x2="23" y2="11"></line></svg>
                        <span>Invita</span>
                    </a>

                    ${userBadge}

                    <a href="#" class="btn-logout" onclick="logout(event)" title="Esci">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </a>
                </div>
            </nav>
        </header>
    `;
}

async function logout(e) {
    if (e) e.preventDefault();
    try { await api.post('/api/me', {}); } catch {}
    window.location.replace('index.html?_=' + Date.now());
}