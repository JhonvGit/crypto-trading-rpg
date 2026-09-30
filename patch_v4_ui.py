with open("static/office.js", "r", encoding="utf-8") as f:
    text = f.read()

# Append UI logic for Mobile tabs

MOBILE_LOGIC = """

// ── MOBILE TABS LOGIC ────────
document.querySelectorAll('.panel-tab-btn').forEach(btn => {
    btn.onclick = () => {
        const target = btn.dataset.ptab;
        document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.getElementById('sec-stats').style.display = (target === 'all') ? 'block' : 'none';
        document.getElementById('sec-chart').style.display = (target === 'all' || target === 'ranking') ? 'block' : 'none';
        document.getElementById('sec-ranking').style.display = (target === 'all' || target === 'ranking') ? 'block' : 'none';
        document.getElementById('sec-activity').style.display = (target === 'all' || target === 'activity') ? 'block' : 'none';
    };
});

const mBtnOffice = document.getElementById("m-btn-office");
const mBtnRank = document.getElementById("m-btn-rank");
const mBtnFeed = document.getElementById("m-btn-feed");

function activateMNav(btnId) {
    [mBtnOffice, mBtnRank, mBtnFeed].forEach(b => { if(b) b.classList.remove("active"); });
    const b = document.getElementById(btnId);
    if(b) b.classList.add("active");
}

if(mBtnOffice) mBtnOffice.onclick = () => { closeMobilePanel(); activateMNav('m-btn-office'); };
if(mBtnRank) mBtnRank.onclick = () => { 
    if(!rightPanel.classList.contains("open")) panelToggle.onclick(); 
    document.querySelector('.panel-tab-btn[data-ptab="ranking"]').click();
    activateMNav('m-btn-rank');
};
if(mBtnFeed) mBtnFeed.onclick = () => { 
    if(!rightPanel.classList.contains("open")) panelToggle.onclick(); 
    document.querySelector('.panel-tab-btn[data-ptab="activity"]').click();
    activateMNav('m-btn-feed');
};
"""

text += MOBILE_LOGIC

with open("static/office.js", "w", encoding="utf-8") as f:
    f.write(text)

