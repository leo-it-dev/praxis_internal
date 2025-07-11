import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PopuplistComponent } from './popuplist.component';

describe('PopuplistComponent', () => {
  let component: PopuplistComponent;
  let fixture: ComponentFixture<PopuplistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PopuplistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PopuplistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
