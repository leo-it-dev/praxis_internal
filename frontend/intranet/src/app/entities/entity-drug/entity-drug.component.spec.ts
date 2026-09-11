import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityDrugComponent } from './entity-drug.component';

describe('EntityDrugComponent', () => {
  let component: EntityDrugComponent;
  let fixture: ComponentFixture<EntityDrugComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityDrugComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityDrugComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
