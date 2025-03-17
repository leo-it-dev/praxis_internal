import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SworkerUiComponent } from './sworker-ui.component';

describe('SworkerUiComponent', () => {
  let component: SworkerUiComponent;
  let fixture: ComponentFixture<SworkerUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SworkerUiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SworkerUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
