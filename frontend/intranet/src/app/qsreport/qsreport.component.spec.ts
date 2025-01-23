import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QsreportComponent } from './qsreport.component';

describe('QsreportComponent', () => {
  let component: QsreportComponent;
  let fixture: ComponentFixture<QsreportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QsreportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QsreportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
