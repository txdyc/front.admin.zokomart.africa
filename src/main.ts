import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'ant-design-vue/dist/reset.css';
import 'uno.css';
import '@/styles/index.css';
import App from './App.vue';
import router from './router';
import { perm } from './directives/perm';
import { i18n } from '@/locales';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.directive('perm', perm);
app.mount('#app');
