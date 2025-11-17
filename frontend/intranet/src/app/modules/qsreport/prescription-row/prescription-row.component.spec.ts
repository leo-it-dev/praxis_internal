import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionRowComponent } from './prescription-row.component';

describe('PrescriptionRowComponent', () => {
  let component: PrescriptionRowComponent;
  let fixture: ComponentFixture<PrescriptionRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrescriptionRowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
