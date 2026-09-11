import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityCustomerComponent } from './entity-customer.component';

describe('EntityCustomerComponent', () => {
  let component: EntityCustomerComponent;
  let fixture: ComponentFixture<EntityCustomerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityCustomerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityCustomerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
