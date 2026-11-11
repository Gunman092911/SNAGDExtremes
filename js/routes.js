import List from './pages/List.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Submit from './pages/Submit.js';
import Admin from './pages/Admin.js';
import ResetPassword from './pages/ResetPassword.js';

export default [
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
    { path: '/submit', component: Submit },
    { path: '/admin', component: Admin },
    { path: '/reset-password', component: ResetPassword },
];
