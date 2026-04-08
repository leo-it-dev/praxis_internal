import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TravelExpensesMapComponent } from './travel-expenses-map.component';

describe('TravelExpensesMapComponent', () => {
  let component: TravelExpensesMapComponent;
  let fixture: ComponentFixture<TravelExpensesMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TravelExpensesMapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TravelExpensesMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
