import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SystemOverviewComponent } from './system-overview/system-overview.component';
import { QsreportComponent } from './modules/qsreport/qsreport.component';
import { NewsComponent } from './news/news.component';
import { TravelExpensesMapComponent } from './travel-expenses-map/travel-expenses-map.component';

export const routes: Routes = [
    {path: 'login', component: LoginComponent},
    {path: 'qs', component: QsreportComponent},
    {path: 'system', component: SystemOverviewComponent},
    {path: 'news', component: NewsComponent},
    {path: 'travel-expenses', component: TravelExpensesMapComponent}
];